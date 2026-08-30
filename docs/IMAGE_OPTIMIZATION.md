# Automatic Image Optimization

## Existing architecture and integration points

The application uses browser-side Supabase clients, public Storage buckets, URL columns on content tables, and RLS for administrative writes. There was no backend image-upload controller or Multer layer. Administrative image uploads exist in Officers, Announcements, Events, Gallery, The Patch, and Bukas Kaban. Student avatars come from the authenticated OAuth provider; the QR image picker decodes a local QR and does not upload it.

Supabase Edge Functions cannot run native Sharp. Vercel Functions support the Node runtime and native Node packages, but their request body is smaller than the application's 10 MiB incoming-image ceiling. The integrated flow therefore uses the existing private `ccis-private-drafts` bucket as short-lived staging instead of adding a storage provider or sending image bytes through PostgreSQL.

## Runtime pipeline

1. The frontend checks the byte signature and the 10 MiB limit.
2. The authenticated staff client uploads the original to `ccis-private-drafts/image-processing/{user-id}/{uuid}.{detected-extension}`.
3. The client calls same-origin `POST /api/media/optimize` with its bearer token and a small JSON request.
4. The Node function validates the token against Supabase Auth, loads the caller's approved profile, rejects active bans, and verifies the exact role/category/entity/bucket/folder combination.
5. The function downloads the private staged object with the caller's own RLS-scoped Supabase client. No service-role credential is used.
6. Sharp decodes the bytes, rejects unsupported or malformed content, enforces 10 MiB, 16,384 pixels on either edge, 40 megapixels, and one frame, then applies `.rotate()` for EXIF orientation.
7. Sharp resizes with `fit: inside` and `withoutEnlargement: true`, encodes WebP near quality 82 with effort 4, and strips EXIF, GPS, XMP, ICC, and other source metadata by not retaining metadata.
8. The function writes server-named immutable objects under `{folder}/v2/{uuid}/{variant}.webp` using `image/webp` and `31536000, immutable` cache control.
9. The private original is deleted before the `media_assets` metadata row is committed. The browser retries staging deletion in `finally` after timeouts and failures.
10. Existing content URL columns remain authoritative. Banner records use the 960px card variant when available; the main version and other variants remain recorded in `media_assets`.

If a variant upload or metadata insert fails, the function removes every object already created. If a later content-table write fails, the form removes the complete managed variant group and metadata row. Replacements and record deletions remove old managed `v2` groups only after the database mutation succeeds. Legacy production media is retained during replacement for rollback safety.

## Presets

| Category | Main long edge | Target | Hard ceiling | Additional variants |
| --- | ---: | ---: | ---: | --- |
| Officer | 900 px | 150 KiB | 300 KiB | None |
| Gallery | 1600 px | 350 KiB | 600 KiB | Thumbnail at 480 px |
| Announcement/event banner | 1920 px | 500 KiB | 1 MiB | Card at 960 px, mobile at 720 px |
| Patch thumbnail | 640 px | 150 KiB | 300 KiB | None |
| Document preview | 640 px | 120 KiB | 200 KiB | None |

Variants smaller than the source are generated where the category uses them. A source already within a variant's dimensions is not duplicated. Quality starts at the category's 76-82 setting and is reduced conservatively only when the result exceeds the target; dimensions are reduced only if the hard ceiling still cannot be met.

## Security and failure boundaries

- Actual decode and Sharp metadata determine validity; extensions, browser MIME, and filenames are not trusted.
- Source paths must belong to the authenticated user and contain UUIDs.
- Destination bucket, folder, category, entity type, and allowed roles are server allowlisted.
- Output filenames are generated on the server and cannot contain traversal segments.
- Pixel, dimension, byte, frame, JSON-body, and bearer-token bounds prevent unbounded work.
- The function uses the publishable key plus caller JWT, so Storage and table RLS remain authoritative.
- Only approved, non-banned staff can use the current upload contexts. There is no existing user-supplied profile-image upload to preserve or migrate.
- Error responses contain bounded public messages and do not expose Storage internals, tokens, or filesystem paths.

## Database changes

`20260828055012_optimize_scaling_egress_and_rls.sql` creates `public.media_assets`, its indexes, grants, and forced RLS policies. `20260830091121_allow_media_asset_owner_cleanup.sql` adds a DELETE policy limited to `created_by = auth.uid()` so an uploader can roll back only their own metadata. DevCom's existing administrative delete policy remains unchanged.

Both migrations passed a clean local migration replay and the RLS/SQL behavior suite. Neither migration has been pushed to production.

## Measured baseline and expected effect

The read-only 2026-08-28 baseline measured 101.71 MiB across 23 officer originals, 14.37 MiB across 15 banners, and 6.74 MiB across three Patch thumbnails. At the configured targets, the modeled full officer set is about 2.76 MiB (97.4% below the measured originals), banners are about 7.32 MiB at 500 KiB each (about 49% below baseline), and Patch thumbnails are about 450 KiB (about 93.5% below baseline).

Those figures are targets, not post-deployment measurements. Actual CDN transfer, cached response headers, and production object sizes must be captured after the separately approved rollout. Existing production objects are not converted or deleted by this request.

## Deployment and rollback

Deployment order after explicit approval:

1. Reconcile local and remote migration history.
2. Review and push the scaling migration followed by the creator-cleanup migration.
3. Confirm `media_assets` grants/RLS and private staging policies.
4. Deploy the Vercel application using Node 22 or 24 with existing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` or `VITE_` equivalents.
5. Run one authorized upload for every category, inspect stored MIME/cache metadata, and verify replacement cleanup.
6. Capture cold/warm browser Network results and rerun the storage audit.

Rollback does not require deleting uploaded media. Redeploy the previous frontend/function version so new uploads use the previous path. Keep `media_assets` and managed objects for investigation. If the creator-cleanup permission itself must be disabled, apply a reviewed forward migration that drops `media_assets_creator_delete`; do not rewrite applied migrations.
