CREATE INDEX "artist_profiles_primary_genre_id_idx" ON "artist_profiles" USING btree ("primary_genre_id");--> statement-breakpoint
CREATE INDEX "battles_genre_id_idx" ON "battles" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "listening_parties_genre_id_idx" ON "listening_parties" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "projects_genre_id_idx" ON "projects" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "tracks_genre_id_idx" ON "tracks" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "videos_genre_id_idx" ON "videos" USING btree ("genre_id");