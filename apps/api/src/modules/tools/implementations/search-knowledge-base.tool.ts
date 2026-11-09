import { Injectable } from '@nestjs/common';
import { type SearchKnowledgeBaseArgs, SearchKnowledgeBaseArgsSchema } from '@voice-agent/contracts';
import { AppConfigService, truncate } from '../../../common';
import { RetrievalEvaluator, RetrievalService } from '../../knowledge';
import { type Tool, type ToolContext, type ToolResult } from '../tool.port';

export interface SearchKnowledgeBaseData {
  assessment: 'strong' | 'weak' | 'none';
  reason: string;
  passages: { ref: number; document: string; section: string; text: string; score: number }[];
  guidance: string;
}

const GUIDANCE: Record<SearchKnowledgeBaseData['assessment'], string> = {
  strong: 'Answer from these passages and cite them with [ref] markers.',
  weak: 'Only partially relevant. Try ONE reformulated search with different wording; if still weak, tell the user what you found and what you could not confirm.',
  none: 'Nothing relevant. Do not guess. Tell the user the knowledge base does not cover this and suggest who to ask or offer to open a ticket.',
};

@Injectable()
export class SearchKnowledgeBaseTool implements Tool<SearchKnowledgeBaseArgs, SearchKnowledgeBaseData> {
  readonly name = 'search_knowledge_base' as const;
  readonly description =
    'Search the Orbital Labs knowledge base (employee handbook, HR, IT, finance and benefits policies). ' +
    'Call this before answering any question about company policies, processes, holidays, benefits or tools. ' +
    'Provide 1-3 query phrasings; results come back with a relevance assessment and numbered passages to cite.';
  readonly schema = SearchKnowledgeBaseArgsSchema;
  readonly timeoutMs = 15_000;
  readonly mutating = false;

  constructor(
    private readonly retrieval: RetrievalService,
    private readonly evaluator: RetrievalEvaluator,
    private readonly config: AppConfigService,
  ) {}

  async execute(args: SearchKnowledgeBaseArgs, context: ToolContext): Promise<ToolResult<SearchKnowledgeBaseData>> {
    const topK = args.topK ?? this.config.agent.retrievalTopK;
    const outcome = await this.retrieval.search({
      queries: args.queries,
      topK,
      mode: 'hybrid',
      rerank: this.config.agent.rerankEnabled,
      signal: context.signal,
    });
    const evaluation = this.evaluator.evaluate(outcome.hits);

    const passages = outcome.hits.map((hit) => {
      const source = context.citations.register({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        documentSlug: hit.documentSlug,
        documentTitle: hit.documentTitle,
        sectionPath: hit.sectionPath,
        excerpt: truncate(hit.content, 400),
        score: hit.scores.fused,
      });
      return {
        ref: source.index,
        document: hit.documentTitle,
        section: hit.sectionPath,
        text: hit.content,
        score: Number((hit.scores.dense ?? hit.scores.fused).toFixed(3)),
      };
    });

    const documents = [...new Set(passages.map((p) => p.document))];
    return {
      data: { assessment: evaluation.assessment, reason: evaluation.reason, passages, guidance: GUIDANCE[evaluation.assessment] },
      summary: passages.length
        ? `${passages.length} passages (${evaluation.assessment}) from ${documents.slice(0, 3).join(', ')}${documents.length > 3 ? '…' : ''}`
        : 'No passages found',
      retrieval: {
        assessment: evaluation.assessment,
        topScore: evaluation.topScore,
        hits: passages.length,
        queries: outcome.queries,
        reason: evaluation.reason,
      },
    };
  }
}
