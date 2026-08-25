# Official Domain Cache Verification

The cache-fresh official route `https://zurs.me/?release=10e91304&cachecheck=1` redirected to the canonical `https://www.zurs.me` domain and then loaded the current ZURS.me header, dotted storefront shell, banner, authenticated account controls, and all nine provider-backed game cards. The visible production shell matches the latest published visual update; the catalog completed loading rather than remaining in a stale loading state.

The Payment Control remains disabled by default. The pending VPS worker is not part of this verification because its HTTPS certificate challenge remains blocked at the Oracle network layer.

After the Oracle ingress remediation, the effective Linux firewall order was corrected so TCP 80 and 443 precede the existing universal reject rule. Let’s Encrypt then issued a certificate for `pay-worker.zurs.me`; the PM2 worker is online and its HTTPS health endpoint is reachable. A cache-bypass recheck of `www.zurs.me/?release=10e91304&fresh=202608250046` loaded the current ZURS.me wordmark, dotted visual shell, authenticated controls, and nine game cards successfully.
