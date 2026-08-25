# Payment Control Release Status

Checkpoint `a6ef29fa` contains the default-off owner Payment Control, server-side payment gates, and the storefront shell update. Local desktop and mobile previews passed visual review.

At the latest cache-fresh official-domain check, `www.zurs.me/?release=a6ef29fa` still served the preceding header that contained **ZURS STORE** and **GAMING & DIGITAL**. The new release must therefore not be represented as cache-fresh live until the official domain begins serving the compact **ZURS.me** header. Public payment remains off regardless of this propagation state.
