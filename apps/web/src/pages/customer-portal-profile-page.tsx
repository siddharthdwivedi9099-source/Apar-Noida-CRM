import { useEffect, useState } from "react";
import type { CustomerPortalFeedbackResponse, CustomerPortalProfileSummary } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalProfilePage() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<CustomerPortalProfileSummary | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadProfile() {
    setErrorMessage(null);
    const response = await apiRequest<{ profile: CustomerPortalProfileSummary }>("/customer-portal/profile", { accessToken });
    setProfile(response.profile);
    setJobTitle(response.profile.jobTitle ?? "");
    setPhone(response.profile.phone ?? "");
  }

  useEffect(() => {
    void loadProfile().catch((error: Error) => setErrorMessage(error.message));
  }, [accessToken]);

  async function saveProfile() {
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiRequest<{ profile: CustomerPortalProfileSummary }>("/customer-portal/profile", {
        method: "PATCH",
        accessToken,
        body: {
          jobTitle,
          phone,
          preferences: profile?.preferences ?? {}
        }
      });
      setProfile(response.profile);
      setStatusMessage("Profile updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Profile could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitFeedback() {
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalFeedbackResponse>("/customer-portal/feedback", {
        method: "POST",
        accessToken,
        body: {
          feedbackType: "csat",
          rating: Number(rating),
          comment
        }
      });
      setStatusMessage(`Feedback submitted with rating ${response.feedback.rating ?? "n/a"}.`);
      setComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Feedback could not be submitted.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile && !errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading customer profile...</CardTitle>
          <CardDescription>Opening your customer portal account profile.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <Badge>{profile?.portalRole ?? "Customer"}</Badge>
          <CardTitle>Customer Profile</CardTitle>
          <CardDescription>Your portal profile is linked to one tenant account boundary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile ? (
            <>
              <div className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{profile.displayName}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                <p className="text-sm text-muted-foreground">Account</p>
                <p className="font-semibold">{profile.account.name}</p>
                <p className="text-sm text-muted-foreground">{profile.account.website ?? "No website on file"}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold">
                  Job title
                  <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job title" />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  Phone
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
                </label>
              </div>
              <Button disabled={isSaving} onClick={() => void saveProfile()}>
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            </>
          ) : null}
          {statusMessage ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200">{statusMessage}</p> : null}
          {errorMessage ? <p className="text-sm font-medium text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback / CSAT</CardTitle>
          <CardDescription>Share quick customer satisfaction feedback from inside the portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-2 text-sm font-semibold">
            Rating
            <select className={selectClassName} value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Needs work</option>
              <option value="1">1 - Poor</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Comment
            <textarea className={textareaClassName} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tell us how the portal is working for you" />
          </label>
          <Button disabled={isSaving} onClick={() => void submitFeedback()}>
            Submit feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
