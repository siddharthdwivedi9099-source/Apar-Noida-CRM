import { useEffect, useMemo, useState } from "react";
import type {
  CreateTrainingProgramRequestBody,
  MyTrainingResponse,
  TrainingAssignmentDetail,
  TrainingAssignmentsResponse,
  TrainingDashboardResponse,
  TrainingOptionsResponse,
  TrainingProgramDetail,
  TrainingProgramsResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateOnly, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type TrainingTab = "catalog" | "assignments" | "portal";

export function TrainingPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<TrainingOptionsResponse | null>(null);
  const [dashboard, setDashboard] = useState<TrainingDashboardResponse | null>(null);
  const [programs, setPrograms] = useState<TrainingProgramsResponse | null>(null);
  const [assignmentsData, setAssignmentsData] = useState<TrainingAssignmentsResponse | null>(null);
  const [myTraining, setMyTraining] = useState<MyTrainingResponse | null>(null);
  const [programDetail, setProgramDetail] = useState<TrainingProgramDetail | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<TrainingAssignmentDetail | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [tab, setTab] = useState<TrainingTab>("catalog");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [programForm, setProgramForm] = useState({ title: "", description: "", categoryKey: "", levelKey: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState("");
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

  const canCreate = hasAnyPermission(["training.create", "training.configure"]);
  const canManage = hasAnyPermission(["training.create", "training.edit", "training.configure", "training.manage_workflow"]);
  const canAssign = hasAnyPermission(["training.assign", "training.create", "training.edit", "training.configure"]);

  const programList = useMemo(() => programs?.programs ?? [], [programs?.programs]);
  const assignmentList = useMemo(() => assignmentsData?.assignments ?? [], [assignmentsData?.assignments]);

  async function loadAll() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [optionsRes, dashRes, programsRes, assignmentsRes, portalRes] = await Promise.all([
        apiRequest<TrainingOptionsResponse>("/training/options", { method: "GET", accessToken }),
        apiRequest<TrainingDashboardResponse>("/training/dashboard", { method: "GET", accessToken }),
        apiRequest<TrainingProgramsResponse>("/training/programs?pageSize=100", { method: "GET", accessToken }),
        apiRequest<TrainingAssignmentsResponse>("/training/assignments?pageSize=100", { method: "GET", accessToken }),
        apiRequest<MyTrainingResponse>("/training/portal/my-training", { method: "GET", accessToken })
      ]);
      setOptions(optionsRes);
      setDashboard(dashRes);
      setPrograms(programsRes);
      setAssignmentsData(assignmentsRes);
      setMyTraining(portalRes);
      setProgramForm((current) => (current.categoryKey ? current : { title: "", description: "", categoryKey: optionsRes.categories[0]?.key ?? "", levelKey: optionsRes.levels[0]?.key ?? "" }));
      setAssignProgramId((current) => current || optionsRes.programs[0]?.id || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  useEffect(() => {
    if (programList.length === 0) {
      setSelectedProgramId(null);
      return;
    }
    setSelectedProgramId((current) => (current && programList.some((p) => p.id === current) ? current : programList[0].id));
  }, [programList]);

  useEffect(() => {
    if (assignmentList.length === 0) {
      setSelectedAssignmentId(null);
      return;
    }
    setSelectedAssignmentId((current) => (current && assignmentList.some((a) => a.id === current) ? current : assignmentList[0].id));
  }, [assignmentList]);

  async function loadProgramDetail(id: string) {
    if (!accessToken) return;
    try {
      const response = await apiRequest<{ program: TrainingProgramDetail }>(`/training/programs/${id}`, { method: "GET", accessToken });
      setProgramDetail(response.program);
      setLessonModuleId((current) => current || response.program.modules[0]?.id || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function loadAssignmentDetail(id: string) {
    if (!accessToken) return;
    try {
      const response = await apiRequest<{ assignment: TrainingAssignmentDetail }>(`/training/assignments/${id}`, { method: "GET", accessToken });
      setAssignmentDetail(response.assignment);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!selectedProgramId) {
      setProgramDetail(null);
      return;
    }
    void loadProgramDetail(selectedProgramId);
  }, [accessToken, selectedProgramId]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      setAssignmentDetail(null);
      return;
    }
    void loadAssignmentDetail(selectedAssignmentId);
  }, [accessToken, selectedAssignmentId]);

  async function handleCreateProgram(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    const payload: CreateTrainingProgramRequestBody = {
      title: programForm.title.trim(),
      description: programForm.description.trim() || null,
      categoryKey: programForm.categoryKey,
      levelKey: programForm.levelKey,
      status: "draft"
    };
    try {
      const response = await apiRequest<{ program: TrainingProgramDetail }>("/training/programs", { method: "POST", accessToken, body: payload });
      setIsCreating(false);
      setProgramForm({ title: "", description: "", categoryKey: options?.categories[0]?.key ?? "", levelKey: options?.levels[0]?.key ?? "" });
      await loadAll();
      setSelectedProgramId(response.program.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function handleAddModule(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !programDetail || moduleTitle.trim().length < 2) return;
    try {
      await apiRequest(`/training/programs/${programDetail.id}/modules`, { method: "POST", accessToken, body: { title: moduleTitle.trim() } });
      setModuleTitle("");
      await loadProgramDetail(programDetail.id);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAddLesson(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !programDetail || !lessonModuleId || lessonTitle.trim().length < 2) return;
    try {
      await apiRequest(`/training/programs/${programDetail.id}/modules/${lessonModuleId}/lessons`, { method: "POST", accessToken, body: { title: lessonTitle.trim() } });
      setLessonTitle("");
      await loadProgramDetail(programDetail.id);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !assignProgramId) return;
    try {
      const response = await apiRequest<{ assignment: TrainingAssignmentDetail }>("/training/assignments", { method: "POST", accessToken, body: { programId: assignProgramId, assigneeType: "user", userId: assignUserId || null } });
      await loadAll();
      setTab("assignments");
      setSelectedAssignmentId(response.assignment.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleMarkLesson(assignmentId: string, lessonId: string) {
    if (!accessToken) return;
    try {
      await apiRequest(`/training/assignments/${assignmentId}/progress`, { method: "POST", accessToken, body: { lessonId, status: "completed" } });
      await loadAssignmentDetail(assignmentId);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading training workspace" description="Training programs, assignments, and the learner portal are loading from the tenant-safe API." />;
  }

  if (!options || !dashboard) {
    return (
      <CrmEmptyState title="The training workspace could not be loaded." description={errorMessage ?? "The current tenant session could not load training."} action={<Button variant="outline" onClick={() => void loadAll()}>Retry</Button>} />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Customer training"
        title="Training programs, lessons, assignments, and a learner portal run from one workspace."
        summary="Build training programs with modules and lessons, assign them to users and accounts, track progress and completion, link training to onboarding and customer success, and give learners a portal for their assigned training."
        actions={canCreate ? <Button onClick={() => setIsCreating((c) => !c)}>{isCreating ? "Close form" : "Create program"}</Button> : null}
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Programs" value={String(dashboard.totalPrograms)} description="Training programs in the catalog." />
            <CrmMetricCard label="Assignments" value={String(dashboard.totalAssignments)} description="Training assignments issued." />
            <CrmMetricCard label="Completed" value={String(dashboard.completedAssignments)} description="Completed assignments." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Published" value={String(dashboard.publishedPrograms)} description="Published programs." />
        <CrmMetricCard label="In progress" value={String(dashboard.inProgressAssignments)} description="In-progress assignments." />
        <CrmMetricCard label="Avg completion" value={dashboard.averageCompletionPercent === null ? "—" : `${dashboard.averageCompletionPercent}%`} description="Average assignment completion." />
        <CrmMetricCard label="Avg rating" value={dashboard.averageRating === null ? "—" : String(dashboard.averageRating)} description="Average training feedback rating." />
      </section>

      {isCreating && canCreate ? (
        <Card>
          <CardHeader><CardTitle>New training program</CardTitle><CardDescription>Create a program, then add modules and lessons.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateProgram}>
              <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium">Title</span><Input value={programForm.title} onChange={(e) => setProgramForm((c) => ({ ...c, title: e.target.value }))} required minLength={2} /></label>
              <label className="space-y-2"><span className="text-sm font-medium">Category</span>
                <select className={selectClassName} value={programForm.categoryKey} onChange={(e) => setProgramForm((c) => ({ ...c, categoryKey: e.target.value }))}>
                  {options.categories.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2"><span className="text-sm font-medium">Level</span>
                <select className={selectClassName} value={programForm.levelKey} onChange={(e) => setProgramForm((c) => ({ ...c, levelKey: e.target.value }))}>
                  {options.levels.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium">Description</span><textarea className={textareaClassName} rows={2} value={programForm.description} onChange={(e) => setProgramForm((c) => ({ ...c, description: e.target.value }))} /></label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2"><Button type="submit">Create program</Button><Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["catalog", "assignments", "portal"] as TrainingTab[]).map((value) => (
          <Button key={value} variant={tab === value ? "default" : "outline"} size="sm" onClick={() => setTab(value)}>
            {value === "portal" ? "My Training" : value.charAt(0).toUpperCase() + value.slice(1)}
          </Button>
        ))}
      </div>

      {tab === "catalog" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Program catalog</CardTitle><CardDescription>Training programs with module and lesson counts.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {programList.length === 0 ? (
                <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm text-muted-foreground">No training programs yet.</div>
              ) : (
                programList.map((program) => (
                  <button key={program.id} type="button" onClick={() => setSelectedProgramId(program.id)} className={cn("w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50", selectedProgramId === program.id ? "border-primary bg-primary/5" : "")}>
                    <div className="flex flex-wrap items-center gap-2"><Badge>{program.status}</Badge><Badge variant="muted">{program.category?.label ?? "—"}</Badge><Badge variant="muted">{program.level?.label ?? "—"}</Badge></div>
                    <p className="mt-3 font-semibold">{program.title}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{program.moduleCount} modules • {program.lessonCount} lessons • {program.assignmentCount} assignments</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
          <ProgramDetailCard detail={programDetail} canManage={canManage} moduleTitle={moduleTitle} setModuleTitle={setModuleTitle} lessonTitle={lessonTitle} setLessonTitle={setLessonTitle} lessonModuleId={lessonModuleId} setLessonModuleId={setLessonModuleId} onAddModule={handleAddModule} onAddLesson={handleAddLesson} />
        </section>
      ) : null}

      {tab === "assignments" ? (
        <section className="space-y-4">
          {canAssign ? (
            <Card>
              <CardHeader><CardTitle>Assign training</CardTitle><CardDescription>Assign a program to a user.</CardDescription></CardHeader>
              <CardContent>
                <form className="flex flex-wrap gap-2" onSubmit={handleAssign}>
                  <select className={selectClassName} value={assignProgramId} onChange={(e) => setAssignProgramId(e.target.value)}>
                    {options.programs.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                  </select>
                  <select className={selectClassName} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                    <option value="">Unassigned user</option>
                    {options.owners.map((o) => (<option key={o.id} value={o.id}>{o.displayName}</option>))}
                  </select>
                  <Button type="submit">Assign</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
          <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader><CardTitle>Assignments</CardTitle><CardDescription>Training assigned to users and accounts.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {assignmentList.length === 0 ? (
                  <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm text-muted-foreground">No assignments yet.</div>
                ) : (
                  assignmentList.map((assignment) => (
                    <button key={assignment.id} type="button" onClick={() => setSelectedAssignmentId(assignment.id)} className={cn("w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50", selectedAssignmentId === assignment.id ? "border-primary bg-primary/5" : "")}>
                      <div className="flex flex-wrap items-center gap-2"><Badge>{assignment.status}</Badge><Badge variant="muted">{assignment.completionPercent}%</Badge></div>
                      <p className="mt-3 font-semibold">{assignment.program?.title ?? "Program"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{assignment.user?.displayName ?? assignment.account?.name ?? "Unassigned"} • {assignment.completedLessonCount}/{assignment.lessonCount} lessons</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
            <AssignmentDetailCard detail={assignmentDetail} onMarkLesson={handleMarkLesson} />
          </section>
        </section>
      ) : null}

      {tab === "portal" ? (
        <section className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CrmMetricCard label="Assigned" value={String(myTraining?.assignedCount ?? 0)} description="Training assigned to you." />
            <CrmMetricCard label="In progress" value={String(myTraining?.inProgressCount ?? 0)} description="Training you are working through." />
            <CrmMetricCard label="Completed" value={String(myTraining?.completedCount ?? 0)} description="Training you have completed." />
          </section>
          <Card>
            <CardHeader><CardTitle>My training</CardTitle><CardDescription>Lessons and progress for training assigned to you.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {!myTraining || myTraining.assignments.length === 0 ? (
                <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm text-muted-foreground">No training is currently assigned to you.</div>
              ) : (
                myTraining.assignments.map((assignment) => (
                  <button key={assignment.id} type="button" onClick={() => { setSelectedAssignmentId(assignment.id); setTab("assignments"); }} className="w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50">
                    <div className="flex flex-wrap items-center gap-2"><Badge>{assignment.status}</Badge><Badge variant="muted">{assignment.completionPercent}%</Badge></div>
                    <p className="mt-3 font-semibold">{assignment.program?.title ?? "Program"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{assignment.completedLessonCount}/{assignment.lessonCount} lessons • Due {formatDateOnly(assignment.dueDate)}</p>
                  </button>
                ))
              )}
              {myTraining ? <div className="rounded-[1rem] border border-dashed border-border/60 p-3 text-sm text-muted-foreground">{myTraining.recommendedTrainingPlaceholder.message}</div> : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function ProgramDetailCard({ detail, canManage, moduleTitle, setModuleTitle, lessonTitle, setLessonTitle, lessonModuleId, setLessonModuleId, onAddModule, onAddLesson }: {
  detail: TrainingProgramDetail | null;
  canManage: boolean;
  moduleTitle: string;
  setModuleTitle: React.Dispatch<React.SetStateAction<string>>;
  lessonTitle: string;
  setLessonTitle: React.Dispatch<React.SetStateAction<string>>;
  lessonModuleId: string;
  setLessonModuleId: React.Dispatch<React.SetStateAction<string>>;
  onAddModule: (event: React.FormEvent) => void;
  onAddLesson: (event: React.FormEvent) => void;
}) {
  if (!detail) {
    return <Card><CardHeader><CardTitle>Program detail</CardTitle><CardDescription>Select a program to manage its modules and lessons.</CardDescription></CardHeader><CardContent><div className="rounded-[1.25rem] bg-background/75 p-4 text-sm text-muted-foreground">No program selected.</div></CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>{detail.title}</CardTitle><CardDescription>{detail.status} • {detail.category?.label ?? "—"} • {detail.lessonCount} lessons • {detail.feedbackCount} feedback ({detail.averageRating ?? "—"})</CardDescription></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {detail.modules.length === 0 ? (
          <p className="text-muted-foreground">No modules yet.</p>
        ) : (
          detail.modules.map((module) => (
            <div key={module.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <p className="font-medium">{module.title} <span className="text-xs text-muted-foreground">({module.lessonCount} lessons)</span></p>
              {module.lessons.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {module.lessons.map((lesson) => (<li key={lesson.id} className="flex flex-wrap items-center gap-2"><span>{lesson.title}</span><Badge variant="muted">{lesson.lessonType}</Badge>{lesson.assets.length > 0 ? <Badge variant="muted">{lesson.assets.length} assets</Badge> : null}</li>))}
                </ul>
              ) : null}
            </div>
          ))
        )}
        {canManage ? (
          <div className="space-y-2">
            <form className="flex gap-2" onSubmit={onAddModule}><Input placeholder="New module title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} /><Button type="submit" variant="outline">Add module</Button></form>
            {detail.modules.length > 0 ? (
              <form className="flex flex-wrap gap-2" onSubmit={onAddLesson}>
                <select className={selectClassName} value={lessonModuleId} onChange={(e) => setLessonModuleId(e.target.value)}>{detail.modules.map((m) => (<option key={m.id} value={m.id}>{m.title}</option>))}</select>
                <Input placeholder="New lesson title" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
                <Button type="submit" variant="outline">Add lesson</Button>
              </form>
            ) : null}
          </div>
        ) : null}
        {detail.aiPlaceholders.actions.length > 0 ? (
          <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI placeholders</p><div className="mt-2 flex flex-wrap gap-2">{detail.aiPlaceholders.actions.map((action) => (<Button key={action.key} variant="outline" size="sm" disabled title={action.description}>{action.label}</Button>))}</div></div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AssignmentDetailCard({ detail, onMarkLesson }: { detail: TrainingAssignmentDetail | null; onMarkLesson: (assignmentId: string, lessonId: string) => void }) {
  if (!detail) {
    return <Card><CardHeader><CardTitle>Assignment detail</CardTitle><CardDescription>Select an assignment to track lesson progress.</CardDescription></CardHeader><CardContent><div className="rounded-[1.25rem] bg-background/75 p-4 text-sm text-muted-foreground">No assignment selected.</div></CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>{detail.program?.title ?? "Assignment"}</CardTitle><CardDescription>{detail.status} • {detail.completionPercent}% complete • {detail.completedLessonCount}/{detail.lessonCount} lessons</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {detail.progress.length === 0 ? (
          <p className="text-muted-foreground">This program has no lessons yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.progress.map((item) => (
              <li key={item.lessonId} className="flex items-center justify-between gap-2 rounded-[1rem] border border-border/60 bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2"><span className={cn("font-medium", item.status === "completed" ? "line-through text-muted-foreground" : "")}>{item.lessonTitle}</span><Badge variant="muted">{item.status}</Badge></div>
                {item.status !== "completed" ? <Button type="button" variant="outline" size="sm" onClick={() => onMarkLesson(detail.id, item.lessonId)}>Complete</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
