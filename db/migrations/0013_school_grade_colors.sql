CREATE TABLE "school_grade_colors" (
  "school_id" uuid NOT NULL,
  "grade" integer NOT NULL,
  "color_hex" varchar(7) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "school_grade_colors_pk" PRIMARY KEY ("school_id", "grade"),
  CONSTRAINT "school_grade_colors_grade_check" CHECK ("grade" BETWEEN 7 AND 12),
  CONSTRAINT "school_grade_colors_hex_check" CHECK ("color_hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "school_grade_colors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "school_grade_colors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "school_grade_colors" ADD CONSTRAINT "school_grade_colors_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE POLICY "school_isolation" ON "school_grade_colors" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);
