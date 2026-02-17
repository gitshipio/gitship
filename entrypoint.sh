#!/bin/bash
set -e
mkdir -p /tmp/k8s-webhook-server/serving-certs
echo "Generating self-signed webhook certificate..."
openssl req -x509 -newkey rsa:4096 -nodes \
  -out /tmp/k8s-webhook-server/serving-certs/tls.crt \
  -keyout /tmp/k8s-webhook-server/serving-certs/tls.key \
  -days 365 \
  -subj "/CN=webhook-service.${SYSTEM_NAMESPACE:-gitship-system}.svc"

echo "Starting manager..."
ls -lR /tmp/k8s-webhook-server
exec /manager "$@"
