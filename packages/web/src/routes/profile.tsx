import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Bell, Loader2, Check } from "lucide-react";

interface ProfileData {
  full_name: string | null;
  email: string | null;
  daily_digest_enabled: boolean;
  weekly_digest_enabled: boolean;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: null,
    email: null,
    daily_digest_enabled: false,
    weekly_digest_enabled: false,
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, daily_digest_enabled, weekly_digest_enabled")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      } else if (data) {
        setProfile({
          full_name: data.full_name,
          email: data.email,
          daily_digest_enabled: data.daily_digest_enabled ?? false,
          weekly_digest_enabled: data.weekly_digest_enabled ?? false,
        });
      }
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        daily_digest_enabled: profile.daily_digest_enabled,
        weekly_digest_enabled: profile.weekly_digest_enabled,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      console.error("Error updating profile:", error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      {/* Account Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Update your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="fullName" className="text-sm font-medium mb-2 block">
              Full Name
            </label>
            <Input
              id="fullName"
              value={profile.full_name || ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium mb-2 block">
              Email
            </label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{profile.email || user?.email}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed here
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Digest Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Digest
          </CardTitle>
          <CardDescription>
            Choose how often you want to receive video digest emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="dailyDigest"
              checked={profile.daily_digest_enabled}
              onCheckedChange={(checked) =>
                setProfile({ ...profile, daily_digest_enabled: checked === true })
              }
            />
            <div>
              <label htmlFor="dailyDigest" className="text-sm font-medium cursor-pointer">
                Daily Digest
              </label>
              <p className="text-xs text-muted-foreground">
                Receive a summary of yesterday's videos every morning
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="weeklyDigest"
              checked={profile.weekly_digest_enabled}
              onCheckedChange={(checked) =>
                setProfile({ ...profile, weekly_digest_enabled: checked === true })
              }
            />
            <div>
              <label htmlFor="weeklyDigest" className="text-sm font-medium cursor-pointer">
                Weekly Digest
              </label>
              <p className="text-xs text-muted-foreground">
                Receive a summary of the week's videos every Sunday
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
