# Classkit

## Google Drive technical spike

Milestone 5 needs a Google Cloud **Web application** OAuth client. Create one without a client secret, enable the Google Drive API, and configure the OAuth consent screen. Add your local and deployed addresses to **Authorized JavaScript origins**.

Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` to the public web client ID. Never put a client secret or access token in this repository.

Run `npm run dev`, open `/drive-spike`, then manually verify Google sign-in, the `drive.appdata` consent prompt, JSON create/read/update/delete, and an avatar upload/download/delete. This diagnostic route is available only in local development builds. The access token lives only in memory.

## Verifying Classkit synchronization

1. Create or edit a class, then select **Connect Drive** in the app header.
2. Complete the Google authorization prompt. The header should briefly show **Saving to Drive…** and then **Saved locally** once the queued write completes.
3. To prove the data was uploaded rather than only cached, open the app in a separate browser profile (or clear this site's IndexedDB), authorize the same Google account, and select **Connect Drive**. The classes should be restored from the private Drive folder.

Files in `appDataFolder` are intentionally hidden from the normal Google Drive UI. Classkit stores one versioned `classkit.json` snapshot there, so the separate-browser restoration check is the reliable end-to-end verification. Any time the browser is refreshed, Drive must be connected again because tokens are intentionally kept only in memory.
