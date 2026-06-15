import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UnauthorizedPageProps {
  title: string;
  description: string;
}

export function UnauthorizedPage({ title, description }: UnauthorizedPageProps) {
  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <Badge>Restricted module</Badge>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h2 className="font-display text-4xl font-semibold leading-tight">{title}</h2>
            <p className="text-base leading-7 text-muted-foreground">{description}</p>
          </div>
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/12 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Access guidance</CardTitle>
          <CardDescription>
            The route exists, but the current role set does not grant the module-level permissions needed to open it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Ask a tenant administrator to assign a role that includes this module.</p>
          <p>The sidebar already hides modules that are outside your current permission set.</p>
          <p>Refreshing your session after a role change will load the updated navigation and access controls.</p>
        </CardContent>
      </Card>
    </div>
  );
}
