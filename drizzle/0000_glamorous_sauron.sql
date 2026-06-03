CREATE TABLE "app_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "easysell_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" varchar(255) NOT NULL,
	"external_order_id" varchar(100) NOT NULL,
	"date_heure" timestamp,
	"nom_complet" varchar(255),
	"telephone" varchar(50),
	"adresse" text,
	"note_client" text,
	"nom_produit" varchar(255),
	"prix_unitaire" numeric(12, 2),
	"quantite" integer,
	"prix_total" numeric(12, 2),
	"status" varchar(50),
	"note" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
