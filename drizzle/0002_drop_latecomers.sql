-- The "latecomers" clan type was removed; those clans are ordinary CWL clans.
UPDATE "clans" SET "cwl_type" = 'cwl' WHERE "cwl_type" = 'latecomers';
