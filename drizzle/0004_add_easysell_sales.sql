CREATE TABLE "easysell_product_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"easysell_product_name" varchar(255) NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "easysell_product_mappings_easysell_product_name_unique" UNIQUE("easysell_product_name")
);
--> statement-breakpoint
CREATE TABLE "easysell_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_order_id" varchar(100) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"quantity" integer,
	"unit_price" numeric(12, 2),
	"total_price" numeric(12, 2),
	"sale_date" timestamp,
	"reconciliation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"product_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "easysell_product_mappings" ADD CONSTRAINT "easysell_product_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easysell_sales" ADD CONSTRAINT "easysell_sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;