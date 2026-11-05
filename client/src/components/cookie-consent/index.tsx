import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCookieConsent } from "@/lib/cookie-consent";

export const CookieConsent = () => {
  const { consent, decided, acceptAll, rejectNonEssential, save } = useCookieConsent();
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  const [marketing, setMarketing] = useState(consent?.marketing ?? false);

  // Allow the "Cookie settings" footer trigger (and app settings) to reopen.
  useEffect(() => {
    const handler = () => {
      setAnalytics(consent?.analytics ?? false);
      setMarketing(consent?.marketing ?? false);
      setOpen(true);
    };
    window.addEventListener("cn:open-cookie-preferences", handler);
    return () => window.removeEventListener("cn:open-cookie-preferences", handler);
  }, [consent]);

  const openPreferences = () => {
    setAnalytics(consent?.analytics ?? false);
    setMarketing(consent?.marketing ?? false);
    setOpen(true);
  };

  return (
    <>
      {!decided && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#0b0404]/95 p-4 backdrop-blur md:inset-x-4 md:bottom-4 md:rounded-xl md:border"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-white/70">
              We use cookies to run CloudNest and, with your consent, to improve
              it. Essential cookies are always on. Choose how we use the others,
              or read our{" "}
              <Link to="/privacy-policy" className="text-red-200 underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={openPreferences}>
                Manage preferences
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={rejectNonEssential}
              >
                Reject non-essential
              </Button>
              <Button size="sm" onClick={acceptAll} className="bg-red-500 text-white hover:bg-red-400">
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-white/15 bg-[#0b0404] text-white">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription className="text-white/60">
              Manage how CloudNest uses cookies. Essential cookies cannot be
              disabled because they enable core functionality.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Row
              title="Strictly necessary"
              body="Sign-in, security, and load balancing. Always on."
              checked
              disabled
            />
            <Row
              title="Analytics"
              body="Help us understand how CloudNest is used so we can improve it."
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
            <Row
              title="Marketing"
              body="Measure campaigns and relevant messaging. Off by default."
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={rejectNonEssential} className="text-white/70 hover:bg-white/10 hover:text-white">
              Reject all
            </Button>
            <Button variant="outline" onClick={acceptAll} className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
              Accept all
            </Button>
            <Button onClick={() => save(analytics, marketing)} className="bg-red-500 text-white hover:bg-red-400">
              Save preferences
            </Button>
          </DialogFooter>

          <p className="text-xs text-white/45">
            Read more in our{" "}
            <Link to="/privacy-policy" className="text-red-200 underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms-and-conditions" className="text-red-200 underline">
              Terms
            </Link>
            .
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Row = ({
  title,
  body,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/55">{body}</div>
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={title}
    />
  </div>
);

export default CookieConsent;
