# Appwrite Scope Audit

**Date:** 21 August 2026

The Appwrite Cloud API key for the ZURS STORE project was verified against the Appwrite Project Keys endpoint. The key currently has full project scopes, including database, collection, attribute, document, storage, user, function, key-management, and project-management scopes.

The project owner explicitly approved retaining these scopes temporarily for the Appwrite staging and migration work. The integration keeps `APPWRITE_API_KEY` server-only: it is stored as a protected environment variable, is used only in `server/` tests and `scripts/`, and must never be imported or referenced under `client/`. The React client may use only `VITE_APPWRITE_ENDPOINT` and `VITE_APPWRITE_PROJECT_ID`, which do not grant server privileges.

Before the Appwrite database is enabled for application traffic, review whether the key can be replaced with a dedicated migration key limited to the required Appwrite database scopes.
