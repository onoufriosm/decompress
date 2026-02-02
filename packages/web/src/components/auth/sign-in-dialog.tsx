import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Loader2, CheckCircle } from "lucide-react";

interface SignInDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SignInDialog({ trigger, open: controlledOpen, onOpenChange }: SignInDialogProps) {
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signInWithOtp(email);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (!newOpen) {
      // Reset state when closing
      setEmail("");
      setSent(false);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Only render trigger if provided or in uncontrolled mode */}
      {(trigger || !isControlled) && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="top-4 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get started with Decompress</DialogTitle>
          <DialogDescription>
            Enter your email to sign in or create an account. You'll get a 7-day free trial — no credit card required.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Check your email</h3>
            <p className="text-muted-foreground text-sm">
              We sent a magic link to <strong>{email}</strong>
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Click the link in the email to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Magic Link
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              New users get 7 days free. No credit card needed.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
