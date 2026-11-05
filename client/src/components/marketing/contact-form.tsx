import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTypedSelector } from "@/app/hook";
import { useSubmitContactMutation } from "@/features/contact/contactAPI";
import { PROTECTED_ROUTES } from "@/routes/common/routePath";

export const ContactForm = () => {
  const { accessToken, user } = useTypedSelector((state) => state.auth);
  const signedIn = Boolean(accessToken && user);
  const [submitContact, { isLoading }] = useSubmitContactMutation();

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    subject: "",
    message: "",
  });
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.message.trim().length < 10) {
      toast.error("Please describe your issue in at least 10 characters.");
      return;
    }
    try {
      const res = await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      }).unwrap();
      setDone(true);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.data?.message || "Something went wrong. Please try again.");
    }
  };

  if (done) {
    return (
      <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald-300" />
        <h2 className="text-xl font-semibold">Message received</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/70">
          Thanks for reaching out — our team will respond by email.
          {signedIn && " You can track its status from your dashboard."}
        </p>
        {signedIn ? (
          <Button asChild className="mt-6 rounded-[8px] bg-red-500 text-white hover:bg-red-400">
            <Link to={PROTECTED_ROUTES.SUPPORT}>View my requests</Link>
          </Button>
        ) : (
          <p className="mt-4 text-xs text-white/50">
            Tip: sign in next time and we'll link this to your account so you can
            follow its progress.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cn-name" className="text-white/80">Name</Label>
          <Input
            id="cn-name"
            value={form.name}
            onChange={set("name")}
            required
            maxLength={120}
            placeholder="Jane Doe"
            className="rounded-[8px] border-white/15 bg-white/[0.04] text-white placeholder:text-white/35"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cn-email" className="text-white/80">Email</Label>
          <Input
            id="cn-email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            placeholder="jane@example.com"
            className="rounded-[8px] border-white/15 bg-white/[0.04] text-white placeholder:text-white/35"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cn-subject" className="text-white/80">Subject (optional)</Label>
        <Input
          id="cn-subject"
          value={form.subject}
          onChange={set("subject")}
          maxLength={150}
          placeholder="Google Drive upload failing"
          className="rounded-[8px] border-white/15 bg-white/[0.04] text-white placeholder:text-white/35"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cn-message" className="text-white/80">How can we help?</Label>
        <Textarea
          id="cn-message"
          value={form.message}
          onChange={set("message")}
          required
          minLength={10}
          rows={6}
          placeholder="Describe the error you're seeing, what you expected, and steps to reproduce. Please don't share API keys, tokens, or passwords."
          className="rounded-[8px] border-white/15 bg-white/[0.04] text-white placeholder:text-white/35"
        />
      </div>
      {signedIn && (
        <p className="text-xs text-white/50">
          We'll link this request to <span className="text-white/75">{user?.email}</span> so it
          appears under <span className="text-white/75">My requests</span>.
        </p>
      )}
      <Button
        type="submit"
        disabled={isLoading}
        className="rounded-[8px] bg-red-500 text-white hover:bg-red-400"
      >
        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Send message
      </Button>
    </form>
  );
};

export default ContactForm;
