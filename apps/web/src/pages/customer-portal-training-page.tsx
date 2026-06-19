import { useEffect, useMemo, useState } from "react";
import type {
  CustomerPortalTrainingAssignmentDetail,
  CustomerPortalTrainingAssignmentResponse,
  CustomerPortalTrainingListResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { formatDateOnly } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalTrainingPage() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState<CustomerPortalTrainingAssignmentDetail[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadTraining() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalTrainingListResponse>("/customer-portal/training", { accessToken });
      const details = await Promise.all(
        response.assignments.map((assignment) =>
          apiRequest<CustomerPortalTrainingAssignmentResponse>(`/customer-portal/training/${assignment.id}`, { accessToken }).then((detail) => detail.assignment)
        )
      );
      setAssignments(details);
      setSelectedAssignmentId((currentValue) => currentValue ?? details[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Training assignments could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTraining();
  }, [accessToken]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0] ?? null,
    [assignments, selectedAssignmentId]
  );

  async function markLessonComplete(lessonId: string) {
    if (!selectedAssignment) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalTrainingAssignmentResponse>(`/customer-portal/training/${selectedAssignment.id}/progress`, {
        method: "POST",
        accessToken,
        body: {
          lessonId,
          status: "completed",
          progressPercent: 100
        }
      });
      setAssignments((currentAssignments) =>
        currentAssignments.map((assignment) => (assignment.id === response.assignment.id ? response.assignment : assignment))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Training progress could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>My Training</CardTitle>
          <CardDescription>Published customer training assigned to your user, contact, or account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorMessage ? <p className="text-sm font-medium text-destructive">{errorMessage}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading training...</p> : null}
          {!isLoading && assignments.length === 0 ? <p className="text-sm text-muted-foreground">No customer training is assigned yet.</p> : null}
          {assignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              onClick={() => setSelectedAssignmentId(assignment.id)}
              className="w-full rounded-2xl border border-border bg-white/55 p-4 text-left transition hover:bg-white/80 dark:bg-slate-950/35"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{assignment.program.title}</p>
                  <p className="text-sm text-muted-foreground">Due {formatDateOnly(assignment.dueDate)}</p>
                </div>
                <Badge variant={assignment.status === "completed" ? "success" : "muted"}>{assignment.completionPercent}%</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedAssignment?.program.title ?? "Training Progress"}</CardTitle>
          <CardDescription>
            {selectedAssignment ? selectedAssignment.program.description ?? "Complete each lesson to update your progress." : "Select an assignment to view lessons."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedAssignment ? <p className="text-sm text-muted-foreground">No training assignment selected.</p> : null}
          {selectedAssignment ? (
            <>
              <div className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold">Completion</p>
                  <p className="font-display text-2xl font-semibold">{selectedAssignment.completionPercent}%</p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedAssignment.completionPercent}%` }} />
                </div>
              </div>
              {selectedAssignment.lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold">{lesson.title}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{lesson.lessonType} · {lesson.durationMinutes ?? 0} min</p>
                    </div>
                    <Button
                      size="sm"
                      variant={lesson.progressStatus === "completed" ? "outline" : "default"}
                      disabled={isSaving || lesson.progressStatus === "completed"}
                      onClick={() => void markLessonComplete(lesson.id)}
                    >
                      {lesson.progressStatus === "completed" ? "Completed" : "Mark complete"}
                    </Button>
                  </div>
                  {lesson.content ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{lesson.content}</p> : null}
                </div>
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
