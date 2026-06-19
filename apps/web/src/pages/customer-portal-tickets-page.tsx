import { useEffect, useMemo, useState } from "react";
import type {
  CustomerPortalTicketDetail,
  CustomerPortalTicketListResponse,
  CustomerPortalTicketResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalTicketsPage() {
  const { accessToken } = useAuth();
  const [tickets, setTickets] = useState<CustomerPortalTicketDetail[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");

  async function loadTickets() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalTicketListResponse>("/customer-portal/tickets", { accessToken });
      const details = await Promise.all(
        response.tickets.map((ticket) =>
          apiRequest<CustomerPortalTicketResponse>(`/customer-portal/tickets/${ticket.id}`, { accessToken }).then((detail) => detail.ticket)
        )
      );
      setTickets(details);
      setSelectedTicketId((currentValue) => currentValue ?? details[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tickets could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, [accessToken]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [selectedTicketId, tickets]
  );

  async function createTicket() {
    if (!subject.trim()) {
      setErrorMessage("Add a subject before creating a ticket.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalTicketResponse>("/customer-portal/tickets", {
        method: "POST",
        accessToken,
        body: {
          subject,
          description,
          priorityKey: "medium",
          categoryKey: "technical"
        }
      });
      setTickets((currentTickets) => [response.ticket, ...currentTickets]);
      setSelectedTicketId(response.ticket.id);
      setSubject("");
      setDescription("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ticket could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !reply.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<CustomerPortalTicketResponse>(`/customer-portal/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        accessToken,
        body: { body: reply }
      });
      setTickets((currentTickets) => currentTickets.map((ticket) => (ticket.id === response.ticket.id ? response.ticket : ticket)));
      setReply("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Reply could not be sent.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Create Support Ticket</CardTitle>
            <CardDescription>Tickets are automatically linked to your customer account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
            <textarea className={textareaClassName} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you need help with" />
            <Button disabled={isSaving} onClick={() => void createTicket()}>
              {isSaving ? "Saving..." : "Create ticket"}
            </Button>
            {errorMessage ? <p className="text-sm font-medium text-destructive">{errorMessage}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Tickets</CardTitle>
            <CardDescription>Only tickets for your customer account are shown here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading tickets...</p> : null}
            {!isLoading && tickets.length === 0 ? <p className="text-sm text-muted-foreground">No customer tickets yet.</p> : null}
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
                className="w-full rounded-2xl border border-border bg-white/55 p-4 text-left transition hover:bg-white/80 dark:bg-slate-950/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatDateTime(ticket.updatedAt)}</p>
                  </div>
                  <Badge variant={ticket.id === selectedTicket?.id ? "default" : "muted"}>{ticket.status.label ?? "Open"}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selectedTicket?.subject ?? "Ticket Status Tracking"}</CardTitle>
          <CardDescription>
            {selectedTicket ? `Status: ${selectedTicket.status.label ?? "Open"} · Priority: ${selectedTicket.priority.label ?? "Medium"}` : "Select a ticket to review customer-visible updates."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTicket ? <p className="text-sm text-muted-foreground">No ticket selected.</p> : null}
          {selectedTicket ? (
            <>
              <div className="rounded-2xl border border-border bg-white/50 p-4 dark:bg-slate-950/35">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-2 whitespace-pre-wrap">{selectedTicket.description ?? "No description provided."}</p>
              </div>
              <div className="space-y-3">
                <p className="font-semibold">Customer-visible messages</p>
                {selectedTicket.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customer replies yet. Internal notes are never shown in the portal.</p>
                ) : null}
                {selectedTicket.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{message.authorName ?? "Customer"} · {formatDateTime(message.createdAt)}</p>
                    <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <textarea className={textareaClassName} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add a customer reply" />
                <Button disabled={isSaving || !reply.trim()} onClick={() => void sendReply()}>
                  Send reply
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
