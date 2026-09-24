# Blockchain Procurement & Accounts Payable Ledger
## Phase 1: System Architecture & Design Specification

### 1. High-Level Architecture Overview
The system cleanly decouples high-throughput relational business operations and unstructured document storage from the Hyperledger Fabric immutable audit ledger.

```
                      +---------------------------------------+
                      |       Web Client (React / Vite)       |
                      |  - Role-Based Enterprise Portal       |
                      |  - Real-Time Audit Verification UI    |
                      +-------------------+-------------------+
                                          | HTTPS / REST / JWT
                                          v
+-----------------------------------------------------------------------------------+
|                         Backend Application Layer (Node.js/Express)               |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |   Auth & RBAC      |   |  Procurement Engine   |   |   Payables & Finance   |  |
|  |  JWT / Org Context |   |  PO, Receipt, Inspect |   |  Invoicing & 4-Mo Settle|  |
|  +---------+----------+   +-----------+-----------+   +-----------+------------+  |
|            |                          |                           |               |
|  +---------+--------------------------+---------------------------+------------+  |
|  |                           Transactional Service Layer                       |  |
|  |               (Unit of Work / Transactional Outbox Pattern)                 |  |
|  +--------------------+-----------------------------------+--------------------+  |
|                       |                                   |                       |
+-----------------------|-----------------------------------|-----------------------+
                        |                                   |
         SQL Transaction|                      Dispatched   | Asynchronous/Sync
                        v                      Worker/Queue v Gateway Call
+-------------------------------+      +--------------------------------------------+
|  Relational Database (Postgres)|      |      Blockchain Integration Service        |
|                               |      |  - Fabric Gateway Client (gRPC)            |
|  - Users & Organizations      |      |  - Identity & MSP Management               |
|  - Vendors, POs, Items        |      |  - Document Hash Verification              |
|  - Invoices, Payables         |      +---------------------+----------------------+
|  - Payments, Approvals        |                            | Mutual TLS / gRPC
|  - Outbox Events & Sync State |                            v
+-------------------------------+      +--------------------------------------------+
                                       |       Hyperledger Fabric Network           |
+-------------------------------+      |                                            |
|   Document Storage (Local/S3) |      |  +------------------+  +-----------------+ |
|  - PDF Invoices, Delivery Docs|      |  | Peer Org 1 (Gov) |  | Peer Org 2 (Fin)| |
|  - SHA-256 Digest Computation |      |  +--------+---------+  +--------+--------+ |
+-------------------------------+      |           \                    /           |
                                       |            +--------+---------+            |
                                       |                     |                      |
                                       |             Orderer / Raft Cluster         |
                                       |                     |                      |
                                       |     Channel: 'procurement-channel'         |
                                       |     Chaincode: 'procurement-ledger'        |
                                       +--------------------------------------------+
```
