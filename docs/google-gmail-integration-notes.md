# Google OAuth and Gmail Sender Notes

Google's OAuth 2.0 web-server flow uses an authorization-code redirect, an exact pre-registered callback URI, state validation, and offline access when the application must send mail after the owner leaves the browser. The user must grant only the necessary scopes. Source: https://developers.google.com/identity/protocols/oauth2/web-server

The Gmail API sends a message with `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`. A Gmail sender connection needs one of the documented Gmail send scopes; this project requests `https://www.googleapis.com/auth/gmail.send` only for the owner-authorized sender connection. Source: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
