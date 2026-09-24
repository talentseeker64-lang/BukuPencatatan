#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/setEnv.sh"

CC_NAME="${1:-procurement-ledger}"
CC_SRC_PATH="${SCRIPT_DIR}/../../chaincode"
CC_VERSION="${2:-1.0.0}"
CC_SEQUENCE="${3:-1}"
CHANNEL_NAME="${4:-procurementchannel}"

echo "=== Deploying Chaincode: ${CC_NAME} (v${CC_VERSION}) on ${CHANNEL_NAME} ==="

if command -v peer &> /dev/null; then
  echo "Packaging chaincode..."
  peer lifecycle chaincode package "${CC_NAME}.tar.gz" \
    --path "${CC_SRC_PATH}" --lang node --label "${CC_NAME}_${CC_VERSION}"

  echo "Installing chaincode on Org1..."
  setProcurementOrg
  peer lifecycle chaincode install "${CC_NAME}.tar.gz"

  echo "Installing chaincode on Org2..."
  setVendorOrg
  peer lifecycle chaincode install "${CC_NAME}.tar.gz"

  PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid "${CC_NAME}.tar.gz")
  echo "Package ID: ${PACKAGE_ID}"

  echo "Approving chaincode for Org1..."
  setProcurementOrg
  peer lifecycle chaincode approveformyorg -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" --name "${CC_NAME}" --version "${CC_VERSION}" \
    --package-id "${PACKAGE_ID}" --sequence "${CC_SEQUENCE}" --tls --cafile "${ORDERER_CA}"

  echo "Approving chaincode for Org2..."
  setVendorOrg
  peer lifecycle chaincode approveformyorg -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" --name "${CC_NAME}" --version "${CC_VERSION}" \
    --package-id "${PACKAGE_ID}" --sequence "${CC_SEQUENCE}" --tls --cafile "${ORDERER_CA}"

  echo "Committing chaincode to channel..."
  peer lifecycle chaincode commit -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" --name "${CC_NAME}" --version "${CC_VERSION}" \
    --sequence "${CC_SEQUENCE}" --tls --cafile "${ORDERER_CA}" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/../crypto-material/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/../crypto-material/peerOrganizations/vendor.example.com/peers/peer0.vendor.example.com/tls/ca.crt"

  echo "Chaincode ${CC_NAME} deployed successfully."
else
  echo "Packaging chaincode typescript source for container runtime..."
  cd "${CC_SRC_PATH}" && npm run build || true
  echo "Chaincode package ready."
fi
