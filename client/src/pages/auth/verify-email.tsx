import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/logo/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch } from "@/app/hook";
import { setCredentials } from "@/features/auth/authSlice";
import {
  useResendOtpMutation,
  useVerifyOtpMutation,
} from "@/features/auth/authAPI";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/routes/common/routePath";

const NormalizeBaseLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full min-h-svh">
    <div className="flex flex-col gap-4 p-6 md:p-10 md:pt-6">
      <div className="flex justify-center gap-2 md:justify-start">
        <Logo url="/" />
      </div>
      <div className="flex items-center justify-center">
        <div className="w-full max-w-xs">{children}</div>
      </div>
    </div>
  </div>
);

const VerifyEmail = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const stateEmail = (location.state as { email?: string } | null)?.email ?? "";

  const [emailInput, setEmailInput] = useState(stateEmail);
  const [email, setEmail] = useState(stateEmail);
  const [code, setCode] = useState("");

  const [verify, { isLoading }] = useVerifyOtpMutation();
  const [resend, { isLoading: isResending }] = useResendOtpMutation();

  useEffect(() => {
    if (!email && emailInput.trim()) setEmail(emailInput.trim());
  }, [emailInput, email]);

  const canSubmit = useMemo(
    () => !!email.trim() && code.trim().length >= 6 && !isLoading,
    [email, code, isLoading]
  );

  const submit = () => {
    if (!email.trim()) {
      toast.error("Enter your email address.");
      return;
    }
    verify({ email: email.trim(), code: code.trim() })
      .unwrap()
      .then((data) => {
        dispatch(setCredentials(data));
        toast.success("Email verified — welcome to CloudNest!");
        setTimeout(() => navigate(PROTECTED_ROUTES.OVERVIEW), 800);
      })
      .catch((error) => {
        toast.error(error.data?.message || "We could not verify that code.");
      });
  };

  const doResend = () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }
    resend({ email: email.trim() })
      .unwrap()
      .then(() => toast.success("A new code has been sent to your email."))
      .catch((error) =>
        toast.error(error.data?.message || "Failed to resend the code.")
      );
  };

  return (
    <NormalizeBaseLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="text-balance text-sm text-muted-foreground">
            Enter the 6-digit code we sent to{" "}
            {email ? <span className="font-medium">{email}</span> : "your email"}{" "}
            to activate your account.
          </p>
        </div>

        <div className="grid gap-4">
          {!stateEmail && (
            <div className="grid gap-2">
              <Label className="!font-normal">Email</Label>
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label className="!font-normal">Verification code</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              placeholder="123456"
              className="tracking-[0.5em] text-center"
            />
          </div>

          <Button
            type="button"
            className="w-full !py-4"
            disabled={!canSubmit}
            onClick={submit}
          >
            {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Verify email
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isResending}
            onClick={doResend}
          >
            {isResending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Resend code
          </Button>
        </div>

        <div className="text-center text-sm">
          Wrong account?{" "}
          <Link
            to={AUTH_ROUTES.SIGN_IN}
            className="underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </NormalizeBaseLayout>
  );
};

export default VerifyEmail;
