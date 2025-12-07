import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AzentioLogo } from "@/components/AzentioLogo";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Check if email is confirmed
        if (session.user.email_confirmed_at) {
          navigate("/dashboard");
        } else {
          setShowVerificationDialog(true);
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (session.user.email_confirmed_at) {
          navigate("/dashboard");
        } else {
          setShowVerificationDialog(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid email or password. Please check your credentials.");
      } else if (error.message.includes("Email not confirmed")) {
        setShowVerificationDialog(true);
      } else {
        toast.error(error.message);
      }
    } else if (data.user) {
      if (!data.user.email_confirmed_at) {
        setShowVerificationDialog(true);
      } else {
        toast.success("Signed in successfully");
      }
    }
    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast.error("Failed to resend verification email");
    } else {
      toast.success("Verification email sent! Please check your inbox.");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4 text-center">
          <AzentioLogo variant="dark" size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Variable Pay Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Sales Compensation Portal</p>
          </div>
        </div>

        {/* Auth Card - Sign In Only */}
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
              </div>
              <Button type="submit" variant="accent" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Contact your administrator if you don't have an account.
        </p>
      </div>

      {/* Email Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <CheckCircle2 className="h-6 w-6 text-accent" />
            </div>
            <DialogTitle>Verify Your Email</DialogTitle>
            <DialogDescription className="text-center">
              Please verify your email address to access the application. 
              Check your inbox for a verification link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">
                A verification email has been sent to:
              </p>
              <p className="font-medium text-foreground mt-1">{email}</p>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleResendVerification}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Resend Verification Email"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              After verifying your email, you can sign in to access your account.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
