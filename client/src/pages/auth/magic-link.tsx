import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader, ShieldX } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/logo/logo";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/app/hook";
import { setCredentials } from "@/features/auth/authSlice";
import { useVerifyMagicLinkMutation } from "@/features/auth/authAPI";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/routes/common/routePath";

const MagicLink = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [verify] = useVerifyMagicLinkMutation();
  const [status, setStatus] = useState<"pending" | "verifying" | "error">(
    token ? "verifying" : "error"
  );
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !token) return;
    ranRef.current = true;

    verify({ token })
      .unwrap()
      .then((data) => {
        dispatch(setCredentials(data));
        setStatus("pending");
        toast.success("Signed in with your magic link");
        setTimeout(() => navigate(PROTECTED_ROUTES.OVERVIEW, { replace: true }), 600);
      })
      .catch((error) => {
        setStatus("error");
        toast.error(error.data?.message || "This magic link is no longer valid.");
      });
  }, [token, verify, dispatch, navigate]);

  return (
    <div className="w-full min-h-svh">
      <div className="flex flex-col gap-4 p-6 md:p-10 md:pt-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo url="/" />
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="flex flex-col items-center gap-4 text-center">
              {status === "verifying" && (
                <>
                  <Loader className="size-8 animate-spin text-muted-foreground" />
                  <h1 className="text-2xl font-bold">Signing you in…</h1>
                  <p className="text-sm text-muted-foreground">
                    Verifying your magic link.
                  </p>
                </>
              )}

              {status === "pending" && (
                <>
                  <h1 className="text-2xl font-bold">You're signed in</h1>
                  <p className="text-sm text-muted-foreground">
                    Taking you to your dashboard…
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <ShieldX className="size-8 text-muted-foreground" />
                  <h1 className="text-2xl font-bold">Link invalid</h1>
                  <p className="text-sm text-muted-foreground">
                    This sign-in link is invalid, expired, or has already been
                    used. Request a new one or sign in with your password.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={AUTH_ROUTES.SIGN_IN}>Go to sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MagicLink;
