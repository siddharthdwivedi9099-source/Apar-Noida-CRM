import { useRef, useState } from "react";
import type { BulkImportEntity, BulkImportResponse, BulkImportTemplateResponse } from "@crm/types";
import { bulkImportSpecs } from "@crm/types";
import { Download, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero } from "@/components/crm/crm-shell";
import { ScrollableList } from "@/components/crm/scrollable-list";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const entityCards: Array<{ entity: BulkImportEntity; title: string; description: string; permissions: string[] }> = [
  {
    entity: "account",
    title: "Accounts",
    description: "Import accounts first — contacts and opportunities link to them by account name.",
    permissions: ["accounts.import", "accounts.configure"]
  },
  {
    entity: "lead",
    title: "Leads",
    description: "Status and source accept the option key or its label; duplicates are detected by email.",
    permissions: ["leads.import", "leads.configure"]
  },
  {
    entity: "contact",
    title: "Contacts",
    description: "Optionally links each contact to an existing account by name; duplicates detected by email.",
    permissions: ["contacts.import", "contacts.configure"]
  },
  {
    entity: "opportunity",
    title: "Opportunities",
    description: "Requires an existing account per row; stage and source accept option keys or labels.",
    permissions: ["opportunities.import", "opportunities.configure"]
  }
];

function EntityImportCard({ entity, title, description }: { entity: BulkImportEntity; title: string; description: string }) {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const columns = bulkImportSpecs[entity];

  async function downloadTemplate() {
    if (!accessToken) {
      return;
    }
    try {
      const template = await apiRequest<BulkImportTemplateResponse>(`/imports/templates/${entity}`, { accessToken });
      const blob = new Blob([template.csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${entity}-import-template.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleFileChosen(file: File | null) {
    setResult(null);
    setErrorMessage(null);
    if (!file) {
      setFileName(null);
      setCsvText(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(typeof reader.result === "string" ? reader.result : null);
    reader.readAsText(file);
  }

  async function runImport() {
    if (!accessToken || !csvText) {
      return;
    }
    setIsWorking(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const response = await apiRequest<BulkImportResponse>(`/imports/${entity}`, {
        method: "POST",
        accessToken,
        body: { csv: csvText, dryRun, allowDuplicates }
      });
      setResult(response);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => (
            <Badge key={column.key} variant={column.required ? "default" : "muted"} title={column.description}>
              {column.key}
              {column.required ? " *" : ""}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void downloadTemplate()}>
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleFileChosen(event.target.files?.[0] ?? null)}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" /> {fileName ?? "Choose CSV"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
            Dry run (validate only)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowDuplicates} onChange={(event) => setAllowDuplicates(event.target.checked)} />
            Allow duplicates
          </label>
          <Button size="sm" disabled={!csvText || isWorking} onClick={() => void runImport()}>
            {isWorking ? "Importing..." : dryRun ? "Validate file" : "Import records"}
          </Button>
        </div>

        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        {result ? (
          <div className="space-y-3 rounded-[1.25rem] bg-background/75 p-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="muted">{result.dryRun ? "Dry run" : "Imported"}</Badge>
              <Badge variant="success">
                {result.created} {result.dryRun ? "valid" : "created"}
              </Badge>
              <Badge variant="muted">{result.skippedDuplicates} duplicates skipped</Badge>
              <Badge variant={result.failed > 0 ? "danger" : "muted"}>{result.failed} failed</Badge>
              <Badge variant="muted">{result.total} total rows</Badge>
            </div>
            {result.errors.length > 0 ? (
              <ScrollableList
                items={result.errors}
                label="row errors"
                maxHeightClassName="max-h-[16rem]"
                renderItem={(entry) => (
                  <div key={`${entry.row}-${entry.message}`} className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm">
                    <span className="font-semibold">Row {entry.row}:</span> {entry.message}
                  </div>
                )}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BulkImportPage() {
  const { hasAnyPermission } = useAuth();
  const visibleCards = entityCards.filter((card) => hasAnyPermission(card.permissions));

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Data migration"
        title="Bulk upload your previous data — a fixed format per record type."
        summary="Download the fixed CSV template for each entity, fill it from your legacy system, validate with a dry run, then import. Every row runs through the same validations, option sets, duplicate detection, and audit logging as a manually created record."
      />

      {visibleCards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            Your role does not include import permissions for any record type.
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          {visibleCards.map((card) => (
            <EntityImportCard key={card.entity} entity={card.entity} title={card.title} description={card.description} />
          ))}
        </section>
      )}
    </div>
  );
}
