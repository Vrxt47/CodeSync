"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setGeneralError("Invalid email or password. Please verify your credentials.");
        } else if (err.errors && err.errors.length > 0) {
          const map: Record<string, string> = {};
          err.errors.forEach((e) => {
            map[e.field] = e.message;
          });
          setFieldErrors(map);
        } else {
          setGeneralError(err.message || "Failed to sign in. Please try again.");
        }
      } else {
        setGeneralError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#181818] flex items-center justify-center p-4 selection:bg-[#007ACC]/30">
      <div className="w-full max-w-md">
        {/* Logo and Branding Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-lg bg-[#007ACC]/15 border border-[#007ACC]/30 flex items-center justify-center text-[#007ACC] shadow-md group-hover:scale-105 transition-transform">
              <Code2 className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">CodeSync</span>
          </Link>
          <p className="text-xs text-[#858585] mt-2 font-mono">
            High-Performance Collaborative IDE
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#1E1E1E] border-[#303030] shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-[#CCCCCC]">
              Sign in to your account
            </CardTitle>
            <CardDescription className="text-xs text-[#858585]">
              Enter your credentials to access your collaborative environment
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4">
              {/* General Error Banner */}
              {generalError && (
                <div className="p-3 rounded-md bg-[#5A1D1D]/50 border border-[#F14C4C]/40 text-xs text-[#F14C4C] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="email"
                  className={
                    fieldErrors.email ? "border-[#F14C4C] focus-visible:ring-[#F14C4C]" : ""
                  }
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-[#F14C4C] flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className={
                    fieldErrors.password ? "border-[#F14C4C] focus-visible:ring-[#F14C4C]" : ""
                  }
                />
                {fieldErrors.password && (
                  <p className="text-[11px] text-[#F14C4C] flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#007ACC] hover:bg-[#0062A3] text-white font-medium h-9 text-xs transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-center text-xs text-[#858585]">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="text-[#007ACC] hover:underline font-medium transition-colors"
                >
                  Create one now
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Security badges info footer */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-[#858585]">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#3FB950]" /> In-Memory JWT Access
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#3FB950]" /> HttpOnly Session Rotation
          </span>
        </div>
      </div>
    </div>
  );
}
