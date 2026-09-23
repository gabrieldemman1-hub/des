import { createContext, use } from 'react';
import {
  createLookups,
  knowledge,
  knowledgeIssues,
  type KnowledgeBase,
  type KnowledgeIssue,
  type KnowledgeLookups,
} from '../../../knowledge/index';

export interface KnowledgeApi extends KnowledgeLookups {
  kb: KnowledgeBase;
  issues: readonly KnowledgeIssue[];
}

export function createKnowledgeApi(kb: KnowledgeBase, issues: readonly KnowledgeIssue[] = []): KnowledgeApi {
  return { kb, issues, ...createLookups(kb) };
}

/** The compiled-in knowledge base. Tests provide their own with `<KnowledgeContext value={…}>`. */
export const KnowledgeContext = createContext<KnowledgeApi>(createKnowledgeApi(knowledge, knowledgeIssues));

export function useKnowledge(): KnowledgeApi {
  return use(KnowledgeContext);
}
