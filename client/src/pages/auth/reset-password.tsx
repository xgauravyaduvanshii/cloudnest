import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/logo/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPasswordMutation } from "@/features/auth/authAPI";
import { AUTH_ROUTES } from "@/routes/common/routePath";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [reset, { isLoading }] = useResetPasswordMutation();

  const canSubmit = useMemo(
    () => !!token && password.length >= 6 && password === confirm && !isLoading,
    [token, password, confirm, isLoading]
  );

  const submit = () => {
    if (!token) {
      toast.error("This reset link is invalid. Request a new one.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    reset({ token, password })
      .unwrap()
      .then(() => setDone(true))
      .catch((error) =>
        toast.error(error.data?.message || "Failed to reset password.")
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
                <h1 className="text-2xl font-bold">Choose a new password</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  {token
                    ? "Set a new password for your account."
                    : "This reset link is missing its token."}
                </p>
              </div>

              {!token ? (
                <Button variant="outline" className="w-full" asChild>
                  <Link to={AUTH_ROUTES.FORGOT_PASSWORD}>
                    Request a new link
                  </Link>
                </Button>
              ) : done ? (
                <div className="flex flex-col items-center gap-3 rounded-md border p-6 text-center">
                  <p className="text-sm">
                    Your password has been updated. You can now sign in with
                    your new password.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate(AUTH_ROUTES.SIGN_IN)}
                  >
                    Go to sign in
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="!font-normal">New password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="*******"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="!font-normal">Confirm password</Label>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="*******"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full !py-4"
                    disabled={!canSubmit}
                    onClick={submit}
                  >
                    {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Reset password
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
