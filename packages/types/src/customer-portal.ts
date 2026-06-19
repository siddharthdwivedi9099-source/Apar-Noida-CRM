export type CustomerPortalStatus = "active" | "inactive";
export type CustomerPortalFeedbackType = "csat" | "product_feedback" | "portal_feedback";

export interface CustomerPortalAccountSummary {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
}

export interface CustomerPortalContactSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export interface CustomerPortalProfileSummary {
  id: string;
  status: CustomerPortalStatus;
  portalRole: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  account: CustomerPortalAccountSummary;
  contact: CustomerPortalContactSummary | null;
  preferences: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPortalDashboardResponse {
  profile: CustomerPortalProfileSummary;
  metrics: {
    openTicketCount: number;
    resolvedTicketCount: number;
    trainingAssignedCount: number;
    trainingCompletedCount: number;
    knowledgeArticleCount: number;
    activeAiSessionCount: number;
  };
  placeholders: {
    productAnnouncements: Array<{
      title: string;
      description: string;
      status: "placeholder";
    }>;
    feedback: {
      csatEnabled: boolean;
      message: string;
    };
  };
}

export interface CustomerPortalTicketSummary {
  id: string;
  subject: string;
  description: string | null;
  status: {
    key: string | null;
    label: string | null;
    color: string | null;
  };
  priority: {
    key: string | null;
    label: string | null;
    color: string | null;
  };
  category: {
    key: string | null;
    label: string | null;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CustomerPortalTicketMessage {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface CustomerPortalTicketDetail extends CustomerPortalTicketSummary {
  messages: CustomerPortalTicketMessage[];
}

export interface CustomerPortalTicketListResponse {
  tickets: CustomerPortalTicketSummary[];
}

export interface CustomerPortalTicketResponse {
  ticket: CustomerPortalTicketDetail;
}

export interface CreateCustomerPortalTicketRequestBody {
  subject: string;
  description?: string | null;
  priorityKey?: string;
  categoryKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCustomerPortalTicketMessageRequestBody {
  body: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerPortalKnowledgeArticleSummary {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string | null;
  updatedAt: string;
}

export interface CustomerPortalKnowledgeArticleDetail extends CustomerPortalKnowledgeArticleSummary {
  body: string | null;
}

export interface CustomerPortalKnowledgeListResponse {
  articles: CustomerPortalKnowledgeArticleSummary[];
}

export interface CustomerPortalKnowledgeArticleResponse {
  article: CustomerPortalKnowledgeArticleDetail;
}

export interface CustomerPortalAskAiRequestBody {
  question: string;
}

export interface CustomerPortalAskAiCitation {
  articleId: string;
  title: string;
  snippet: string;
}

export interface CustomerPortalAskAiResponse {
  sessionId: string;
  answer: string;
  citations: CustomerPortalAskAiCitation[];
  escalated: boolean;
  relatedTicketId: string | null;
}

export interface CustomerPortalTrainingLessonSummary {
  id: string;
  title: string;
  lessonType: string;
  durationMinutes: number | null;
  content: string | null;
  progressStatus: string | null;
  progressPercent: number;
  sortOrder: number;
}

export interface CustomerPortalTrainingAssignmentSummary {
  id: string;
  status: string;
  completionPercent: number;
  dueDate: string | null;
  program: {
    id: string;
    title: string;
    description: string | null;
    estimatedMinutes: number | null;
  };
  updatedAt: string;
}

export interface CustomerPortalTrainingAssignmentDetail extends CustomerPortalTrainingAssignmentSummary {
  lessons: CustomerPortalTrainingLessonSummary[];
}

export interface CustomerPortalTrainingListResponse {
  assignments: CustomerPortalTrainingAssignmentSummary[];
}

export interface CustomerPortalTrainingAssignmentResponse {
  assignment: CustomerPortalTrainingAssignmentDetail;
}

export interface UpdateCustomerPortalTrainingProgressRequestBody {
  lessonId: string;
  status?: "not_started" | "in_progress" | "completed";
  progressPercent?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerPortalProfileRequestBody {
  jobTitle?: string | null;
  phone?: string | null;
  preferences?: Record<string, unknown>;
}

export interface CreateCustomerPortalFeedbackRequestBody {
  feedbackType?: CustomerPortalFeedbackType;
  rating?: number | null;
  comment?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerPortalFeedbackResponse {
  feedback: {
    id: string;
    feedbackType: CustomerPortalFeedbackType;
    rating: number | null;
    comment: string | null;
    createdAt: string;
  };
}
