import type {
  ConversationDetail,
  ConversationListResponse,
  DocumentDetail,
  DocumentListResponse,
  EmployeeListResponse,
  HealthStatus,
  IngestionJobListResponse,
  LeaveBalance,
  ReindexResponse,
  SearchRequest,
  SearchResponse,
  SupportTicket,
  TicketListResponse,
  TicketStatus,
  ToolListResponse,
  ToolUsageResponse,
  TurnRequest,
  TurnResponse,
  UploadDocumentRequest,
  UploadDocumentResponse,
} from '@voice-agent/contracts';
import { api, apiRequest } from '../api-client';

/** Thin, typed functions for every REST endpoint; components never build URLs themselves. */
export const healthApi = {
  get: () => api.get<HealthStatus>('/health'),
};

export const knowledgeApi = {
  listDocuments: () => api.get<DocumentListResponse>('/knowledge/documents'),
  getDocument: (id: string) => api.get<DocumentDetail>(`/knowledge/documents/${id}`),
  search: (request: Partial<SearchRequest> & { query: string }) =>
    api.post<SearchResponse>('/knowledge/search', request),
  reindex: (force = false) => api.post<ReindexResponse>(`/knowledge/reindex?force=${force}`),
  listJobs: () => api.get<IngestionJobListResponse>('/knowledge/jobs'),
  upload: (request: UploadDocumentRequest) =>
    api.post<UploadDocumentResponse>('/knowledge/documents', request),
  deleteDocument: (slug: string) => api.delete<void>(`/knowledge/documents/${slug}`),
};

export const conversationsApi = {
  list: () => api.get<ConversationListResponse>('/conversations'),
  get: (id: string) => api.get<ConversationDetail>(`/conversations/${id}`),
  delete: (id: string) => api.delete<void>(`/conversations/${id}`),
};

export const agentApi = {
  turn: (request: TurnRequest) => api.post<TurnResponse>('/agent/turn', request),
};

export const hrApi = {
  employees: () => api.get<EmployeeListResponse>('/hr/employees'),
  leaveBalance: (employeeId: string) =>
    api.get<LeaveBalance>(`/hr/employees/${employeeId}/leave-balance`),
  tickets: () => api.get<TicketListResponse>('/hr/tickets'),
  updateTicketStatus: (id: string, status: TicketStatus) =>
    apiRequest<SupportTicket>(`/hr/tickets/${id}/status`, { method: 'PATCH', body: { status } }),
};

export const toolsApi = {
  list: () => api.get<ToolListResponse>('/tools'),
  usage: () => api.get<ToolUsageResponse>('/tools/usage'),
};
