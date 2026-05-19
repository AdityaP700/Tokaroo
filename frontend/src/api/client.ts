const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function apiRequest<T>(endpoint: string, data: any): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return await response.json();
}

export type RagChunk = {
  chunk_index: number;
  similarity_score: number;
  relevance_score?: number | null;
  positional_weight: number;
  attention_weight?: number | null;
  final_importance: number;
  risk_level: string;
  used_by_model?: boolean | null;
  lost_reason?: string | null;
  start_token: number;
  end_token: number;
  token_count: number;
  boundary_snippet: string;
};

export type RagResponse = {
  model: string;
  total_original_tokens: number;
  total_chunks_created: number;
  chunks_in_prompt: number;
  extra_tokens_due_to_overlap: number;
  error: string | null;
  retrieval_mode?: string | null;
  reranked?: boolean | null;
  rerank_scores?: number[] | null;
  retrieval_analysis?: Record<string, number> | null;
  ignored_relevant_chunks?: number[] | null;
  attention_waste?: number | null;
  reranker_impact?: Record<string, any> | null;
  optimization: {
    diagnosis: {
      primary_issue: string;
      confidence: number;
      impact: string;
      short_summary: string;
    };
    issues?: Array<{ type: string; severity: string }> | null;
    recommended_config?: Record<string, number> | null;
    attention_curve?: number[] | null;
    reorder_effect?: Record<string, any> | null;
    system_insight?: string | null;
    actionable_steps: string[];
    health_score?: number | null;
    is_optimized?: boolean | null;
  };
  chunks: RagChunk[];
};
