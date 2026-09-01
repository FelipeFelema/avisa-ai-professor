-- Representative pre-migration row used by the migration review.
INSERT INTO "User" ("id", "name", "email", "password", "role", "refreshTokenId", "refreshTokenHash", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy User', 'legacy@example.com', 'legacy-hash', 'PARENT', 'legacy-session-id', 'legacy-refresh-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
