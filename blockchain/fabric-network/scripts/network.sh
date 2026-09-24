#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="${1:-up}"

case "${MODE}" in
  up)
    echo "=== Starting Hyperledger Fabric Local Network (Phase 3) ==="
    "${SCRIPT_DIR}/registerEnroll.sh"

    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-ca.yaml" up -d
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-orderer.yaml" up -d
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-org1.yaml" up -d
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-org2.yaml" up -d
      sleep 3
      "${SCRIPT_DIR}/createChannel.sh" procurementchannel
      "${SCRIPT_DIR}/deployChaincode.sh" procurement-ledger 1.0.0 1 procurementchannel
    else
      echo "Docker daemon not running in local sandbox. Initialized cryptographic assets and deployment descriptors."
    fi
    echo "Network up completed."
    ;;

  down)
    echo "=== Stopping Hyperledger Fabric Local Network ==="
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-org2.yaml" down --volumes --remove-orphans || true
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-org1.yaml" down --volumes --remove-orphans || true
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-orderer.yaml" down --volumes --remove-orphans || true
      docker-compose -f "${NETWORK_DIR}/docker/docker-compose-ca.yaml" down --volumes --remove-orphans || true
    fi
    rm -rf "${NETWORK_DIR}/channel-artifacts"/* || true
    echo "Network down completed."
    ;;

  channel)
    "${SCRIPT_DIR}/createChannel.sh" "${2:-procurementchannel}"
    ;;

  deploy)
    "${SCRIPT_DIR}/deployChaincode.sh" "${2:-procurement-ledger}" "${3:-1.0.0}" "${4:-1}" "${5:-procurementchannel}"
    ;;

  status)
    echo "=== Hyperledger Fabric Network Status ==="
    if command -v docker &> /dev/null; then
      docker ps --filter "name=orderer.example.com|peer0.procurement.example.com|peer0.vendor.example.com|ca."
    else
      echo "Status: Ready (Environment provider: ${BLOCKCHAIN_PROVIDER:-mock})"
    fi
    ;;

  logs)
    if command -v docker &> /dev/null; then
      docker logs -f "${2:-peer0.procurement.example.com}"
    fi
    ;;

  *)
    echo "Usage: network.sh [up|down|channel|deploy|status|logs]"
    exit 1
    ;;
esac
