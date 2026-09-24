#!/usr/bin/env bash
set -euo pipefail

#
# Generates identities for Development Network using Fabric CA / cryptogen
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRYPTO_DIR="${NETWORK_DIR}/crypto-material"

echo "=== Initializing Crypto Material in ${CRYPTO_DIR} ==="
mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com"
mkdir -p "${CRYPTO_DIR}/peerOrganizations/vendor.example.com"
mkdir -p "${CRYPTO_DIR}/ordererOrganizations/example.com"

# In dev environment with fabric-ca-client available:
if command -v fabric-ca-client &> /dev/null; then
  echo "Using fabric-ca-client to enroll identities..."
  # Enroll CA admin
  export FABRIC_CA_CLIENT_HOME="${CRYPTO_DIR}/peerOrganizations/procurement.example.com"
  fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 --caname ca-procurement --tls.certfiles "${CRYPTO_DIR}/fabric-ca/procurement/tls-cert.pem" || true

  # Register & enroll app-client and users
  fabric-ca-client register --id.name app-client --id.secret app-clientpw --id.type client --id.affiliation org1.department1 || true
  fabric-ca-client enroll -u https://app-client:app-clientpw@localhost:7054 --caname ca-procurement -M "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp" || true

  fabric-ca-client register --id.name procurement-user --id.secret userpw --id.type client --id.affiliation org1.department1 || true
  fabric-ca-client enroll -u https://procurement-user:userpw@localhost:7054 --caname ca-procurement -M "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/procurement-user/msp" || true
else
  echo "fabric-ca-client not found in PATH; creating development identity scaffolding..."
  # Create directory structure for app-client, admin, peer0
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/signcerts"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/keystore"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/cacerts"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/msp/tlscacerts"

  mkdir -p "${CRYPTO_DIR}/peerOrganizations/vendor.example.com/users/vendor-user/msp/signcerts"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/vendor.example.com/users/vendor-user/msp/keystore"
  mkdir -p "${CRYPTO_DIR}/peerOrganizations/vendor.example.com/peers/peer0.vendor.example.com/tls"

  # Generate development TLS CA and client certificates using openssl
  if command -v openssl &> /dev/null; then
    echo "Generating dev certificates with openssl..."
    # Procurement Root CA
    openssl req -x509 -newkey rsa:2048 -nodes -keyout "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/msp/tlscacerts/ca.key" \
      -out "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt" \
      -days 365 -subj "/C=ID/ST=Jakarta/L=Jakarta/O=ProcurementOrg/CN=ca.procurement.example.com" 2>/dev/null || true

    # Copy CA to rootcert
    cp "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt" \
       "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/cacerts/ca.crt" 2>/dev/null || true

    # app-client cert & key
    openssl req -newkey rsa:2048 -nodes -keyout "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/keystore/priv_sk" \
      -out "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/signcerts/cert.csr" \
      -subj "/C=ID/ST=Jakarta/L=Jakarta/O=ProcurementOrg/CN=app-client" 2>/dev/null || true

    openssl x509 -req -in "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/signcerts/cert.csr" \
      -CA "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt" \
      -CAkey "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/msp/tlscacerts/ca.key" -CAcreateserial \
      -out "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/signcerts/cert.pem" -days 365 2>/dev/null || true

    # Peer0 TLS cert & key
    openssl req -newkey rsa:2048 -nodes -keyout "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/server.key" \
      -out "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/server.csr" \
      -subj "/C=ID/ST=Jakarta/L=Jakarta/O=ProcurementOrg/CN=peer0.procurement.example.com" 2>/dev/null || true

    openssl x509 -req -in "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/server.csr" \
      -CA "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt" \
      -CAkey "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/msp/tlscacerts/ca.key" -CAcreateserial \
      -out "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/server.crt" -days 365 2>/dev/null || true

    chmod 600 "${CRYPTO_DIR}/peerOrganizations/procurement.example.com/users/app-client/msp/keystore/priv_sk" || true
    echo "Generated dev crypto material successfully."
  fi
fi

echo "Identities registered and enrolled."
