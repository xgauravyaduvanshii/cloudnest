import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader, MailCheck } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/logo/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPasswordMutation } from "@/features/auth/authAPI";
import { AUTH_ROUTES } from "@/routes/common/routePath";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [forgot, { isLoading }] = useForgotPasswordMutation();

  const submit = () => {
    if (!email.trim()) {
      toast.error("Enter your email address.");
      return;
    }
    forgot({ email: email.trim() })
      .unwrap()
      .then(() => setSent(true))
      .catch((error) =>
        toast.error(error.data?.message || "Failed to start password reset.")
      );
  };

  return (
    <div className="w-full min-h-svh">
      <div className="flex flex-col gap-4 p-6 md:p-10 md:pt-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo url="/" />
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Reset your password</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Enter your email and we'll send you a link to choose a new
                  password.
                </p>
              </div>

              {sent ? (
                <div className="flex flex-col items-center gap-3 rounded-md border p-6 text-center">
                  <MailCheck className="size-8 text-muted-foreground" />
                  <p className="text-sm">
                    If an account exists for{" "}
                    <span className="font-medium">{email}</span>, a password
                    reset link is on its way. Check your inbox.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={AUTH_ROUTES.SIGN_IN}>Back to sign in</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="!font-normal">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full !py-4"
                    disabled={isLoading}
                    onClick={submit}
                  >
                    {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Send reset link
                  </Button>
                </div>
              )}

              <div className="text-center text-sm">
                Remembered it?{" "}
                <Link
                  to={AUTH_ROUTES.SIGN_IN}
                  className="underline underline-offset-4"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
