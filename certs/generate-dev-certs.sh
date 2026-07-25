#!/usr/bin/env bash
# Generates a throwaway dev CA plus server/client certificates for the
# mTLS gateway (nginx/mtls-gateway.conf). Not for production use - the CA
# private key is written to disk in cleartext.
#
# Usage: ./certs/generate-dev-certs.sh
set -euo pipefail
cd "$(dirname "$0")"

DAYS=825

echo "== Generating dev CA =="
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS" \
  -subj "/C=NG/O=Open Banking Nigeria Dev Registry/CN=OBN Dev Root CA" \
  -out ca.crt

echo "== Generating mTLS gateway server certificate (matls.openbanking.local) =="
openssl genrsa -out server.key 2048
openssl req -new -key server.key \
  -subj "/C=NG/O=Open Banking Nigeria Dev/CN=matls.openbanking.local" \
  -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days "$DAYS" -sha256 \
  -extfile <(printf "subjectAltName=DNS:matls.openbanking.local,DNS:localhost") \
  -out server.crt
rm -f server.csr

# One client certificate per registered participant in RegistryService's
# mock data, so the CN matches the clientId the app looks up in the
# Open Banking Registry.
for participant in bank-a fintech-x; do
  echo "== Generating TPP client certificate for '$participant' =="
  openssl genrsa -out "client-${participant}.key" 2048
  openssl req -new -key "client-${participant}.key" \
    -subj "/C=NG/O=${participant}/CN=${participant}" \
    -out "client-${participant}.csr"
  openssl x509 -req -in "client-${participant}.csr" -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days "$DAYS" -sha256 \
    -out "client-${participant}.crt"
  rm -f "client-${participant}.csr"
done

rm -f ca.srl
echo
echo "Done. Test the gateway once it's running with:"
echo "  curl --cacert certs/ca.crt --cert certs/client-bank-a.crt --key certs/client-bank-a.key \\"
echo "       https://matls.openbanking.local:8443/gateway/pist/status \\"
echo "       --resolve matls.openbanking.local:8443:127.0.0.1"
