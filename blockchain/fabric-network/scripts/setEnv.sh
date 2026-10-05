#!/usr/bin/env bash
#
# Environment configuration for Fabric CLI & Gateway tools
#

export FABRIC_CFG_PATH="${PWD}/../config"
export VERBOSE=false

# Default to Org1 (ProcurementMSP)
setProcurementOrg() {
  export CORE_PEER_LOCALMSPID="ProcurementMSP"
  export CORE_PEER_TLS_ROOTCERT_FILE="${PWD}/../crypto-material/peerOrganizations/procurement.example.com/peers/peer0.procurement.example.com/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${PWD}/../crypto-material/peerOrganizations/procurement.example.com/users/Admin@procurement.example.com/msp"
  export CORE_PEER_ADDRESS="localhost:7051"
  echo "Switched to ProcurementMSP (peer0:7051)"
}

# Org2 (VendorMSP)
setVendorOrg() {
  export CORE_PEER_LOCALMSPID="VendorMSP"
  export CORE_PEER_TLS_ROOTCERT_FILE="${PWD}/../crypto-material/peerOrganizations/vendor.example.com/peers/peer0.vendor.example.com/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${PWD}/../crypto-material/peerOrganizations/vendor.example.com/users/Admin@vendor.example.com/msp"
  export CORE_PEER_ADDRESS="localhost:9051"
  echo "Switched to VendorMSP (peer0:9051)"
}

export ORDERER_CA="${PWD}/../crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
export ORDERER_ADMIN_TLS_SIGN_CERT="${PWD}/../crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt"
export ORDERER_ADMIN_TLS_PRIVATE_KEY="${PWD}/../crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key"

export CHANNEL_NAME="procurementchannel"
export CC_NAME="procurement-ledger"
export CC_VERSION="1.0.0"
export CC_SEQUENCE="1"
