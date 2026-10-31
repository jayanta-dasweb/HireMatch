# TLS certificates

Place production certificates here (never commit private keys):

- `fullchain.pem`
- `privkey.pem`

Then uncomment the HTTPS `server` block in `deploy/nginx/conf.d/hirematch.conf`.

Recommended: issue certs with Let's Encrypt / Certbot on the host or a sidecar, and mount them read-only into the `proxy` service.
