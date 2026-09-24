#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/setEnv.sh"

CHANNEL_NAME="${1:-procurementchannel}"

echo "=== Creating Channel: ${CHANNEL_NAME} ==="

if command -v configtxgen &> /dev/null && command -v osnadmin &> /dev/null; then
  echo "Generating channel genesis block..."
  configtxgen -profile ProcurementChannelGenesis -outputBlock "${SCRIPT_DIR}/../channel-artifacts/${CHANNEL_NAME}.block" -channelID "${CHANNEL_NAME}"

  echo "Joining orderer to channel..."
  osnadmin channel join --channelID "${CHANNEL_NAME}" \
    --config-block "${SCRIPT_DIR}/../channel-artifacts/${CHANNEL_NAME}.block" \
    -o localhost:7053 --ca-file "${ORDERER_CA}" \
    --client-cert "${ORDERER_ADMIN_TLS_SIGN_CERT}" \
    --client-key "${ORDERER_ADMIN_TLS_PRIVATE_KEY}"

  echo "Joining Peer0 Org1 to channel..."
  setProcurementOrg
  peer channel join -b "${SCRIPT_DIR}/../channel-artifacts/${CHANNEL_NAME}.block"

  echo "Joining Peer0 Org2 to channel..."
  setVendorOrg
  peer channel join -b "${SCRIPT_DIR}/../channel-artifacts/${CHANNEL_NAME}.block"

  echo "Channel ${CHANNEL_NAME} created and joined successfully."
else
  echo "Fabric CLI tools not present in host environment. Ready for Docker network execution."
fi
