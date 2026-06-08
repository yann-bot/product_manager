ALTER TABLE "sales" ADD COLUMN "easysell_sale_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_easysell_sale_id_easysell_sales_id_fk" FOREIGN KEY ("easysell_sale_id") REFERENCES "public"."easysell_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_easysell_sale_id_unique" UNIQUE("easysell_sale_id");