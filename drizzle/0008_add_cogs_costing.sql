CREATE TABLE "sale_lot_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"lot_movement_id" uuid,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cogs" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cogs_recalculated" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "shortfall_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sale_lot_allocations" ADD CONSTRAINT "sale_lot_allocations_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lot_allocations" ADD CONSTRAINT "sale_lot_allocations_lot_movement_id_stock_movements_id_fk" FOREIGN KEY ("lot_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;