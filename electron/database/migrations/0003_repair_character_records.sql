-- One-time repairs of character records. Nothing is deleted: records are only soft-deleted
-- (deleted_at), and only once no grail progress belongs to them.
--
-- 1. Backup copies of a shared stash.
--    Older versions scanned backup copies such as SharedStashSoftCoreV2_Backup.d2i as stashes of
--    their own. The monitor skips them now (see isBackupLikeStashFile), so their records are
--    hidden, unless grail progress belongs to them.
UPDATE characters SET deleted_at = CURRENT_TIMESTAMP
WHERE id IN (
    SELECT id FROM (
      SELECT id, lower(substr(path, length(rtrim(path, replace(path, '/', ''))) + 1)) AS file_name
      FROM (
        SELECT id, replace(save_file_path, '\', '/') AS path FROM characters
        WHERE deleted_at IS NULL AND character_class = 'shared_stash' AND save_file_path IS NOT NULL
      )
    )
    WHERE file_name LIKE '%.d2i'
      AND (
        file_name LIKE '%\_backup%' ESCAPE '\'
        OR file_name LIKE '%.bak.d2i'
        OR file_name LIKE '%\_bak.d2i' ESCAPE '\'
        OR file_name LIKE '%-bak.d2i'
      )
  )
  AND NOT EXISTS (SELECT 1 FROM grail_progress WHERE grail_progress.character_id = characters.id);--> statement-breakpoint
-- 2. Names of .d2i shared stashes.
--    Older versions read the game mode of a .d2i stash from a header field that is not one, so
--    SharedStashHardCoreV2.d2i was stored as "Shared Stash Softcore" (and old v97 files as
--    "Shared Stash Hardcore"). D2R tells its stashes apart by file name, so the hardcore flag and the
--    name are set from the file name. The "Modern" prefix came from the stash version, which was
--    read correctly, and D2R names modern stashes ModernSharedStash*.d2i.
--    A backup copy that step 1 kept because grail progress belongs to it is left as it is, so it
--    does not take the name of the stash it is a copy of.
UPDATE characters SET hardcore = stash.hardcore, name = stash.name
FROM (
    SELECT
      id,
      hardcore,
      CASE WHEN modern THEN 'Modern Shared Stash ' ELSE 'Shared Stash ' END
        || CASE WHEN hardcore THEN 'Hardcore' ELSE 'Softcore' END AS name
    FROM (
      SELECT
        id,
        instr(file_name, 'hardcore') > 0 AS hardcore,
        (old_name LIKE 'Modern %' OR file_name LIKE 'modern%') AS modern
      FROM (
        SELECT
          id,
          name AS old_name,
          lower(substr(path, length(rtrim(path, replace(path, '/', ''))) + 1)) AS file_name
        FROM (
          SELECT id, name, replace(save_file_path, '\', '/') AS path FROM characters
          WHERE deleted_at IS NULL AND character_class = 'shared_stash' AND save_file_path IS NOT NULL
        )
      )
      WHERE file_name LIKE '%.d2i'
        AND NOT (
          file_name LIKE '%\_backup%' ESCAPE '\'
          OR file_name LIKE '%.bak.d2i'
          OR file_name LIKE '%\_bak.d2i' ESCAPE '\'
          OR file_name LIKE '%-bak.d2i'
        )
    )
  ) AS stash
WHERE characters.id = stash.id
  AND (characters.name IS NOT stash.name OR characters.hardcore IS NOT stash.hardcore);--> statement-breakpoint
-- 3. Duplicate records without a save file.
--    Older versions queued character writes, so a scan could create a second record without a save
--    file for a character it had just created (for example four "Barb" records). Such a record is
--    merged into the record with a save file that has the same name and class, when exactly one
--    does: its grail progress, runs and vault items are moved there and it is hidden. The id of a
--    moved progress row still starts with the id of the record it came from. Records with no such
--    unambiguous match are left as they are.
--    If both records have a progress row for the same item, both rows are kept (nothing is deleted),
--    so a character can end up with two rows for one item.
CREATE TEMP TABLE character_merges AS
SELECT
  orphan.id AS orphan_id,
  (
    SELECT live.id FROM characters AS live
    WHERE live.deleted_at IS NULL
      AND live.save_file_path IS NOT NULL
      AND live.name = orphan.name
      AND live.character_class = orphan.character_class
  ) AS live_id
FROM characters AS orphan
WHERE orphan.deleted_at IS NULL
  AND orphan.save_file_path IS NULL
  AND (
    SELECT COUNT(*) FROM characters AS live
    WHERE live.deleted_at IS NULL
      AND live.save_file_path IS NOT NULL
      AND live.name = orphan.name
      AND live.character_class = orphan.character_class
  ) = 1;--> statement-breakpoint
UPDATE grail_progress
SET character_id = (SELECT live_id FROM character_merges WHERE orphan_id = grail_progress.character_id)
WHERE character_id IN (SELECT orphan_id FROM character_merges);--> statement-breakpoint
UPDATE runs
SET character_id = (SELECT live_id FROM character_merges WHERE orphan_id = runs.character_id)
WHERE character_id IN (SELECT orphan_id FROM character_merges);--> statement-breakpoint
UPDATE vault_items
SET source_character_id = (
    SELECT live_id FROM character_merges WHERE orphan_id = vault_items.source_character_id
  )
WHERE source_character_id IN (SELECT orphan_id FROM character_merges);--> statement-breakpoint
UPDATE characters SET deleted_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT orphan_id FROM character_merges);--> statement-breakpoint
DROP TABLE character_merges;
