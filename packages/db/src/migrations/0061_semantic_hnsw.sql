CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_embeddings_embedding_hnsw_idx" ON "search_embeddings" USING hnsw ("embedding" vector_cosine_ops);
