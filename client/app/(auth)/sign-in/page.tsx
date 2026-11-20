"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { GoogleButton } from "@/components/auth/google-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type Values = z.infer<typeof schema>;

function SignInForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const next = params.get("next");
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const { error } = await signIn.email({ email: values.email, password: values.password });
    if (error) {
      if (error.code === "ACCOUNT_BLOCKED") {
        router.replace("/auth-error?error=ACCOUNT_BLOCKED");
        return;
      }
      setFormError(error.message ?? "Could not sign you in. Check your email and password.");
      return;
    }
    queryClient.clear();
    toast.success("Signed in");
    router.push(nextPath);
    router.refresh();
  }

  return (
    <AuthPageLayout imageSrc="/login.png" imageAlt="Illustration for signing in to Mealio">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please enter your details to sign in.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="h-11 w-full" loading={form.formState.isSubmitting}>
            Sign in
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-x-0 top-1/2 border-t" />
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or continue with</span>
            </div>
          </div>

          <GoogleButton
            callbackPath={nextPath}
            newUserCallbackPath={nextPath === "/dashboard" ? "/onboarding" : nextPath}
          />

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href={next ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"}
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </p>
      </form>
    </AuthPageLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
