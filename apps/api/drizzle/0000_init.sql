CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(300) NOT NULL,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_path" text,
	"content" text NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"embedding_model" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"section_path" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"embedded_text" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(1536),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(section_path, '') || ' ' || content)) STORED,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200),
	"user_context" jsonb,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tool_calls" jsonb,
	"tool_call_id" varchar(100),
	"tool_name" varchar(100),
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(20) NOT NULL,
	"conversation_id" uuid,
	"requester_employee_id" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_tsv_gin_idx" ON "chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "conversations_updated_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");