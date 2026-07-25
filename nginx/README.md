# mTLS gateway

Fronts the API's AISP/PISP resource and payment endpoints (`/payments`,
`/gateway/*`, `/past/*`) with mutual TLS, matching the `matls.` host in
`openbanking.yml`. The app itself stays plain HTTP and trusts the identity
this proxy forwards - see `MTLSMiddleware`.

## One-time setup

```bash
# 1. Generate a dev CA + server cert + one client cert per mock TPP
./certs/generate-dev-certs.sh

# 2. Generate a shared secret and put it in a .env file at the repo root
echo "MTLS_GATEWAY_SECRET=$(openssl rand -hex 32)" > .env

# 3. Export the SAME secret in the shell that runs the app
export MTLS_GATEWAY_SECRET=$(grep MTLS_GATEWAY_SECRET .env | cut -d= -f2)
```

## Why the shared secret

The app also stays reachable directly on `:3000` for the browser demo
frontend, which never presents a client certificate (real Open Banking
never has the PSU's browser do that either - only the TPP's own backend
would). That means the `X-SSL-Client-*` identity headers this proxy sets
are, on their own, forgeable by anyone who talks to `:3000` directly. The
`X-Gateway-Secret` header this proxy also injects (from `MTLS_GATEWAY_SECRET`,
never sent to the browser) is what `MTLSMiddleware` actually relies on to
know a request came through here - it fails closed (rejects everything) if
the secret isn't configured or doesn't match. This is a stopgap: the
complete fix is to stop publishing `:3000` on the host at all in a real
deployment, so the gateway is the only network path in.

## Running it

```bash
docker compose up mtls-gateway   # plus postgres/redis/rabbitmq as needed
npm run start:dev                # the app itself, same MTLS_GATEWAY_SECRET in its env
```

## Testing it

```bash
curl --cacert certs/ca.crt --cert certs/client-bank-a.crt --key certs/client-bank-a.key \
     https://matls.openbanking.local:8443/gateway/pist/status \
     --resolve matls.openbanking.local:8443:127.0.0.1
```
