# Farm-to-Market Supply Chain Platform

> **Scenario A --- Farm-to-Market Supply Chain**\
> **Track 2 --- Backend / Fullstack Engineering**

This project is a full-stack farm-to-market platform built around a
simple problem: moving produce from agricultural cooperatives to buyers
should not require everyone to trust a process they cannot see.

The platform connects **buyers, cooperatives, drivers and
administrators** in one order flow. A buyer can find produce and place
an order, stock is reserved safely, payment is protected, a suitable
driver and vehicle can be assigned, the shipment can be followed through
pickup and transit, and the buyer remains part of the final delivery
confirmation.

The goal was not just to make the screens work. I wanted the backend to
model the difficult parts of the process properly: inventory contention,
payment uncertainty, driver allocation, shipment state transitions,
disputes and the possibility of two requests happening at the same time.

------------------------------------------------------------------------

## Table of Contents

-   [What the platform does](#what-the-platform-does)
-   [Tech stack](#tech-stack)
-   [System Architecture](#system-architecture)
-   [Architecture Moat](#architecture-moat)
    -   [Full Database Schema](#1-full-database-schema)
    -   [ER Diagram](#2-entity-relationship-er-diagram)
    -   [Shipment Tracking API](#3-api-endpoints-for-shipment-tracking)
    -   [Security Plan](#4-security-plan)
-   [AI Prompt Ledger](#ai-prompt-ledger)
-   [Cameroonian Context Adaptation](#cameroonian-context-adaptation)
-   [Going Beyond the Brief](#going-beyond-the-brief)
-   [API Documentation](#api-documentation)
-   [Running the project](#running-the-project)
-   [Video Pitch](#video-pitch)

------------------------------------------------------------------------

## What the platform does

There are four main user roles.

**Buyer:** browses produce, places orders, funds a wallet, pays for an
order, tracks delivery, confirms delivery or reports a problem.

**Cooperative:** publishes produce, manages available quantities,
receives orders, follows shipments, views earnings and requests
withdrawals.

**Driver:** manages vehicles, sees assigned shipments and updates the
real delivery journey from pickup to in-transit and delivery reported.

**Admin:** oversees operations, cooperatives, drivers, vehicles, orders,
shipments, transport loads and disputes, and handles dispatch decisions.

The basic journey is:

``` text
Cooperative lists produce
          ↓
Buyer selects produce and places an order
          ↓
Inventory is reserved
          ↓
Payment is secured in a protected hold
          ↓
Shipment is created
          ↓
Admin assigns an eligible driver + vehicle
          ↓
Driver picks up → starts transit → reports delivery
          ↓
Buyer confirms delivery or raises a dispute
          ↓
Protected funds are released or refunded according to the outcome
```

------------------------------------------------------------------------

## Tech Stack

### Frontend

-   Angular
-   TypeScript
-   Role-specific Buyer, Cooperative, Driver and Admin portals

### Backend

-   Node.js
-   Express.js
-   TypeScript
-   Prisma ORM
-   JWT authentication
-   Zod validation
-   OpenAPI / Swagger documentation

### Database

-   PostgreSQL
-   Neon-hosted database
-   Prisma 7

### Payments

-   Fapshi integration for mobile-money collection and payout flows
-   Wallet ledger
-   Protected payment holds
-   Deposit and withdrawal reconciliation

------------------------------------------------------------------------

# System Architecture

I kept the application separated into layers so that the UI does not
contain the rules that protect orders, money or shipments.

``` mermaid
flowchart TB
    subgraph CLIENT["Angular Frontend"]
        B["Buyer Portal"]
        C["Cooperative Portal"]
        D["Driver Portal"]
        A["Admin Portal"]
    end

    subgraph API["Node.js + Express API"]
        AUTH["Authentication & RBAC"]
        PROD["Produce / Inventory"]
        ORD["Orders"]
        WAL["Wallet & Payments"]
        SHIP["Shipments & Dispatch"]
        LOAD["Transport Loads"]
        DISP["Disputes"]
        ADM["Admin Operations"]
    end

    subgraph DATA["Data Layer"]
        PRISMA["Prisma ORM"]
        DB[("PostgreSQL / Neon")]
    end

    subgraph EXTERNAL["External Service"]
        FAPSHI["Fapshi"]
    end

    B --> API
    C --> API
    D --> API
    A --> API

    AUTH --> PRISMA
    PROD --> PRISMA
    ORD --> PRISMA
    WAL --> PRISMA
    SHIP --> PRISMA
    LOAD --> PRISMA
    DISP --> PRISMA
    ADM --> PRISMA

    PRISMA --> DB
    WAL <--> FAPSHI
```

The Angular application is the presentation layer. It has separate
protected experiences for each role, but all important business
decisions are made again on the server.

The Express API is organized by domain: authentication, produce, orders,
wallet, vehicles, drivers, shipments, transport loads, disputes and
administration. Authentication middleware verifies JWT access tokens and
role middleware controls which users can call protected endpoints.

Prisma is the database access layer. PostgreSQL is the source of truth
for users, stock, orders, wallet balances, payment holds, vehicles,
shipments and their state transitions.

Fapshi sits outside the core application. The backend communicates with
it for payment collection and payout operations, while the application's
own wallet, ledger and transaction records preserve the internal
financial state.

------------------------------------------------------------------------

# Architecture Moat

## 1. Full Database Schema

The final relational model contains **18 tables/models**.

### `User`

  Column          Type            Constraint / Default
  --------------- --------------- ----------------------
  id              String (UUID)   Primary key
  fullName        String          Required
  phone           String          Unique
  email           String?         Unique, nullable
  passwordHash    String          Required
  role            UserRole        Required
  status          UserStatus      `PENDING`
  phoneVerified   Boolean         `false`
  createdAt       DateTime        `now()`
  updatedAt       DateTime        Auto updated

### `BuyerProfile`

  Column            Type            Constraint / Default
  ----------------- --------------- ----------------------
  id                String (UUID)   Primary key
  userId            String          FK → User, unique
  buyerType         BuyerType       Required
  businessName      String?         Nullable
  city              String          Required
  deliveryAddress   String?         Nullable
  createdAt         DateTime        `now()`
  updatedAt         DateTime        Auto updated

### `CooperativeProfile`

  Column               Type                 Constraint / Default
  -------------------- -------------------- ----------------------
  id                   String (UUID)        Primary key
  userId               String               FK → User, unique
  name                 String               Required
  description          String?              Nullable
  region               String?              Nullable
  city                 String               Required
  locality             String?              Nullable
  verificationStatus   VerificationStatus   `PENDING`
  createdAt            DateTime             `now()`
  updatedAt            DateTime             Auto updated

### `DriverProfile`

  Column               Type                 Constraint / Default
  -------------------- -------------------- ----------------------
  id                   String (UUID)        Primary key
  userId               String               FK → User, unique
  licenseNumber        String?              Unique, nullable
  city                 String?              Nullable
  verificationStatus   VerificationStatus   `PENDING`
  isAvailable          Boolean              `false`
  createdAt            DateTime             `now()`
  updatedAt            DateTime             Auto updated

### `ProduceListing`

  Column                Type            Constraint / Default
  --------------------- --------------- -------------------------
  id                    String (UUID)   Primary key
  cooperativeId         String          FK → CooperativeProfile
  name                  String          Required
  description           String?         Nullable
  pricePerKg            Decimal(12,2)   Required
  totalQuantityKg       Decimal(12,2)   Required
  availableQuantityKg   Decimal(12,2)   Required
  reservedQuantityKg    Decimal(12,2)   `0`
  harvestDate           DateTime        Required
  originCity            String          Required
  pickupLocation        String?         Nullable
  status                ListingStatus   `DRAFT`
  createdAt             DateTime        `now()`
  updatedAt             DateTime        Auto updated

### `Order`

  Column            Type            Constraint / Default
  ----------------- --------------- -------------------------
  id                String (UUID)   Primary key
  orderNumber       String          Unique
  buyerId           String          FK → BuyerProfile
  cooperativeId     String          FK → CooperativeProfile
  status            OrderStatus     `PENDING_PAYMENT`
  subtotal          Decimal(12,2)   Required
  deliveryFee       Decimal(12,2)   `0`
  totalAmount       Decimal(12,2)   Required
  deliveryCity      String          Required
  deliveryAddress   String          Required
  createdAt         DateTime        `now()`
  updatedAt         DateTime        Auto updated

### `OrderItem`

  Column        Type            Constraint / Default
  ------------- --------------- ----------------------
  id            String (UUID)   Primary key
  orderId       String          FK → Order
  listingId     String          FK → ProduceListing
  produceName   String          Required
  quantityKg    Decimal(12,2)   Required
  unitPrice     Decimal(12,2)   Required
  subtotal      Decimal(12,2)   Required
  createdAt     DateTime        `now()`

`(orderId, listingId)` is unique. `produceName` and `unitPrice` are
snapshots so that a later listing change does not rewrite the commercial
history of an existing order.

### `InventoryReservation`

  Column       Type                Constraint / Default
  ------------ ------------------- ----------------------
  id           String (UUID)       Primary key
  listingId    String              FK → ProduceListing
  orderId      String              FK → Order
  quantityKg   Decimal(12,2)       Required
  status       ReservationStatus   `ACTIVE`
  expiresAt    DateTime            Required
  createdAt    DateTime            `now()`
  updatedAt    DateTime            Auto updated

`(orderId, listingId)` is unique.

### `Wallet`

  Column             Type            Constraint / Default
  ------------------ --------------- ----------------------
  id                 String (UUID)   Primary key
  userId             String          FK → User, unique
  availableBalance   Decimal(14,2)   `0`
  heldBalance        Decimal(14,2)   `0`
  createdAt          DateTime        `now()`
  updatedAt          DateTime        Auto updated

### `WalletLedgerEntry`

  Column        Type                   Constraint / Default
  ------------- ---------------------- ----------------------
  id            String (UUID)          Primary key
  walletId      String                 FK → Wallet
  type          WalletEntryType        Required
  direction     WalletEntryDirection   Required
  amount        Decimal(14,2)          Required
  reference     String?                Nullable
  description   String?                Nullable
  createdAt     DateTime               `now()`

### `WalletDeposit`

  Column                  Type            Constraint / Default
  ----------------------- --------------- ----------------------
  id                      String (UUID)   Primary key
  userId                  String          FK → User
  amount                  Decimal(14,2)   Required
  phone                   String          Required
  medium                  String?         Nullable
  status                  DepositStatus   `CREATED`
  provider                String          `FAPSHI`
  providerTransactionId   String?         Unique, nullable
  externalId              String          Unique
  creditedAt              DateTime?       Nullable
  createdAt               DateTime        `now()`
  updatedAt               DateTime        Auto updated

### `WalletWithdrawal`

  Column                  Type               Constraint / Default
  ----------------------- ------------------ ----------------------
  id                      String (UUID)      Primary key
  userId                  String             FK → User
  walletId                String             FK → Wallet
  amount                  Decimal(14,2)      Required
  phone                   String             Required
  medium                  String?            Nullable
  status                  WithdrawalStatus   `PROCESSING`
  provider                String             `FAPSHI`
  providerTransactionId   String?            Unique, nullable
  externalId              String             Unique
  successfulAt            DateTime?          Nullable
  refundedAt              DateTime?          Nullable
  createdAt               DateTime           `now()`
  updatedAt               DateTime           Auto updated

### `PaymentHold`

  Column      Type                Constraint / Default
  ----------- ------------------- ----------------------
  id          String (UUID)       Primary key
  walletId    String              FK → Wallet
  orderId     String              FK → Order, unique
  amount      Decimal(14,2)       Required
  status      PaymentHoldStatus   `ACTIVE`
  createdAt   DateTime            `now()`
  updatedAt   DateTime            Auto updated

### `Dispute`

  Column         Type                 Constraint / Default
  -------------- -------------------- ----------------------
  id             String (UUID)        Primary key
  orderId        String               FK → Order, unique
  openedById     String               FK → User
  reason         String               Required
  status         DisputeStatus        `OPEN`
  resolution     DisputeResolution?   Nullable
  adminNote      String?              Nullable
  resolvedById   String?              FK → User, nullable
  resolvedAt     DateTime?            Nullable
  createdAt      DateTime             `now()`
  updatedAt      DateTime             Auto updated

### `Vehicle`

  Column           Type            Constraint / Default
  ---------------- --------------- ----------------------
  id               String (UUID)   Primary key
  driverId         String          FK → DriverProfile
  registrationNo   String          Unique
  type             VehicleType     Required
  capacityKg       Decimal(12,2)   Required
  currentCity      String?         Nullable
  status           VehicleStatus   `ACTIVE`
  isAvailable      Boolean         `true`
  createdAt        DateTime        `now()`
  updatedAt        DateTime        Auto updated

### `Shipment`

  Column               Type             Constraint / Default
  -------------------- ---------------- ------------------------------
  id                   String (UUID)    Primary key
  shipmentNumber       String           Unique
  orderId              String           FK → Order, unique
  driverId             String?          FK → DriverProfile, nullable
  vehicleId            String?          FK → Vehicle, nullable
  status               ShipmentStatus   `AWAITING_ASSIGNMENT`
  pickupCity           String           Required
  pickupAddress        String?          Nullable
  deliveryCity         String           Required
  deliveryAddress      String           Required
  loadWeightKg         Decimal(12,2)    Required
  assignedAt           DateTime?        Nullable
  pickedUpAt           DateTime?        Nullable
  deliveryReportedAt   DateTime?        Nullable
  deliveredAt          DateTime?        Nullable
  transportLoadId      String?          FK → TransportLoad, nullable
  createdAt            DateTime         `now()`
  updatedAt            DateTime         Auto updated

### `TransportLoad`

  Column          Type                  Constraint / Default
  --------------- --------------------- ----------------------
  id              String (UUID)         Primary key
  loadNumber      String                Unique
  vehicleId       String                FK → Vehicle
  driverId        String                FK → DriverProfile
  status          TransportLoadStatus   `ASSIGNED`
  pickupCity      String                Required
  deliveryCity    String                Required
  totalWeightKg   Decimal(12,2)         Required
  assignedAt      DateTime              `now()`
  completedAt     DateTime?             Nullable
  createdAt       DateTime              `now()`
  updatedAt       DateTime              Auto updated

### `ShipmentEvent`

  Column       Type                Constraint / Default
  ------------ ------------------- ----------------------
  id           String (UUID)       Primary key
  shipmentId   String              FK → Shipment
  type         ShipmentEventType   Required
  city         String?             Nullable
  note         String?             Nullable
  createdAt    DateTime            `now()`

The schema also uses enums for roles, account and verification states,
buyer types, listing states, wallet entry types, transport states,
shipment states/events, deposit and withdrawal states, payment-hold
states, disputes, orders and inventory reservations.

------------------------------------------------------------------------

## 2. Entity-Relationship (ER) Diagram

``` mermaid
erDiagram
    User ||--o| BuyerProfile : has
    User ||--o| CooperativeProfile : has
    User ||--o| DriverProfile : has
    User ||--o| Wallet : owns

    BuyerProfile ||--o{ Order : places
    CooperativeProfile ||--o{ ProduceListing : publishes
    CooperativeProfile ||--o{ Order : fulfills

    Order ||--|{ OrderItem : contains
    ProduceListing ||--o{ OrderItem : referenced_by

    Order ||--o{ InventoryReservation : reserves
    ProduceListing ||--o{ InventoryReservation : reserves_stock_from

    User ||--o{ WalletDeposit : deposits
    User ||--o{ WalletWithdrawal : requests
    Wallet ||--o{ WalletLedgerEntry : records
    Wallet ||--o{ WalletWithdrawal : funds
    Wallet ||--o{ PaymentHold : protects

    Order ||--o| PaymentHold : secured_by
    Order ||--o| Dispute : may_have

    DriverProfile ||--o{ Vehicle : owns
    DriverProfile ||--o{ Shipment : handles
    Vehicle ||--o{ Shipment : carries

    Order ||--o| Shipment : generates
    Shipment ||--o{ ShipmentEvent : records

    DriverProfile ||--o{ TransportLoad : handles
    Vehicle ||--o{ TransportLoad : carries
    TransportLoad ||--o{ Shipment : groups
```

The shortest way to understand the model is:

``` text
MARKETPLACE: Buyer → Order → Cooperative → Produce
INVENTORY:   Produce → Inventory Reservation → Order
FINANCE:     Wallet → Payment Hold → Delivery/Dispute → Release or Refund
LOGISTICS:   Order → Shipment → Driver → Vehicle → Shipment Events
```

------------------------------------------------------------------------

## 3. API Endpoints for Shipment Tracking

The shipment routes are protected by JWT authentication and role-based
authorization.

### Driver gets assigned shipments

``` http
GET /api/v1/shipments/mine
Authorization: Bearer <access-token>
Role: DRIVER
```

### Driver picks up an assigned shipment

``` http
PATCH /api/v1/shipments/:id/pickup
Authorization: Bearer <access-token>
Role: DRIVER
Content-Type: application/json
```

Example body:

``` json
{
  "city": "Foumbot",
  "note": "Produce collected from cooperative"
}
```

Expected transition:

``` text
ASSIGNED → PICKED_UP
```

### Driver starts the journey

``` http
PATCH /api/v1/shipments/:id/in-transit
Authorization: Bearer <access-token>
Role: DRIVER
```

Example body:

``` json
{
  "city": "Bafoussam",
  "note": "Shipment is on the way"
}
```

Expected transition:

``` text
PICKED_UP → IN_TRANSIT
```

### Driver reports that delivery has been made

``` http
PATCH /api/v1/shipments/:id/report-delivery
Authorization: Bearer <access-token>
Role: DRIVER
```

Example body:

``` json
{
  "city": "Douala",
  "note": "Produce delivered to buyer"
}
```

Expected transition:

``` text
IN_TRANSIT → DELIVERY_REPORTED
```

A driver's report does **not** automatically release the protected
payment. Delivery reporting and final buyer confirmation are
deliberately separated.

### Dispatch

``` http
GET /api/v1/shipments/:id/dispatch-recommendations
Role: ADMIN
```

Returns eligible/ranked dispatch choices.

``` http
PATCH /api/v1/shipments/:id/assign
Role: ADMIN
```

Assigns the selected driver/vehicle to the shipment.

The resulting shipment journey is:

``` text
AWAITING_ASSIGNMENT
        ↓
     ASSIGNED
        ↓
     PICKED_UP
        ↓
     IN_TRANSIT
        ↓
DELIVERY_REPORTED
        ↓
 Buyer confirmation / dispute
        ↓
     DELIVERED
```

Each important shipment transition is also represented as a
`ShipmentEvent`, preserving the tracking history instead of keeping only
the latest status.

------------------------------------------------------------------------

## 4. Security Plan

### Fake and manipulated orders

An order cannot be created as an anonymous action. Private routes use
JWT authentication, and role-based middleware restricts operations to
the appropriate account type.

The backend does not trust the frontend to decide the real price or
available quantity. Produce and inventory are checked on the server.

When an order is being created, inventory is protected through
`InventoryReservation`. Critical inventory operations use database
transactions so competing requests cannot both assume that the same
remaining stock belongs to them.

Orders also have a payment lifecycle. Creating an order is not treated
as proof that money has been received, and secured funds are represented
separately through `PaymentHold`.

The API has request-size limits, CORS restrictions, security headers,
validation, security logging and rate limiting. Authentication endpoints
have a stricter limiter than the general API.

### Preventing double-booking

Availability is represented on both the driver and vehicle:

``` text
DriverProfile.isAvailable
Vehicle.isAvailable
```

Dispatch checks the driver's state, verification and availability, and
checks the vehicle's status, availability and carrying capacity before
assignment.

The important part is that allocation is not protected only by what the
admin screen showed a second earlier. The backend uses
transactional/conditional state changes when claiming logistics
resources. If another request has already taken the resource, the
competing allocation cannot simply proceed with stale availability
information.

This is what prevents two simultaneous dispatch requests from
successfully treating the same driver/vehicle as independently
available.

### Shipment tampering

Driver shipment actions are authenticated and restricted to the `DRIVER`
role. The service also checks ownership of the shipment, so knowing
another shipment ID is not enough to update it.

Shipment status changes follow an allowed state sequence. A driver
cannot legitimately skip from assignment straight to a completed
delivery.

The event history provides an audit trail of important shipment
transitions.

### Payment safety

Wallet activity is recorded in a ledger rather than relying only on a
mutable balance. Provider/external transaction identifiers are unique,
helping the application reconcile payment operations without
intentionally crediting the same provider transaction twice.

A buyer's order payment is kept in a `PaymentHold`. A driver can report
delivery, but that report alone does not give the driver authority to
release money to the cooperative.

Withdrawal processing also includes a `REVIEW_REQUIRED` state. This
matters because a provider or network error after a payout request is
not always proof that no money moved.

------------------------------------------------------------------------

# AI Prompt Ledger

I used AI during development mainly to support **implementation,
debugging, UI refinement and code review** after I had already defined
the product requirements, architecture and business rules. I reviewed
the responses against the project requirements and the existing codebase
before applying changes.

Below are some of the questions and instructions I used during
development, together with why I asked them and what I changed
afterward.

  -----------------------------------------------------------------------
  Prompt / question I     Why I asked it          What I changed or did
  asked AI                                        afterward
  ----------------------- ----------------------- -----------------------
  **"From my backend, is  I wanted to verify that I checked the
  the driver supposed to  the driver portal       suggestion against the
  have a payment tab?"**  matched the             implemented driver and
                          responsibilities        payment flows and kept
                          already defined in the  the driver portal
                          backend instead of      focused on transport
                          adding an unnecessary   and shipment
                          feature.                responsibilities.

  **"Please make the      Some portal sidebars    I applied the
  sidebar scrollable from had enough navigation   navigation improvement
  top to bottom, but hide items to require        across the relevant
  the scrollbar."**       scrolling, especially   portals while keeping
                          on smaller screens.     the existing layout and
                                                  visual structure.

  **"Please make sure     I noticed an            I standardized the
  every sign-out/logout   inconsistency in how an logout action so that
  item on the navbar is a important user action   it behaves and looks
  button and not just     was presented across    like an interactive
  text. It is             the portals.            control across the
  confusing."**                                   application.

  **"Please centralize    Loading feedback was    I adjusted the loading
  the loading statement   not visually consistent states and checked them
  when page data is       on data-driven pages.   across the different
  loading."**                                     portals.

  **"The shipment data    The shipment            I refined the
  representation looks    information was         presentation while
  too dull. Please        functional, but the     preserving the actual
  improve it without      visual hierarchy did    shipment data and
  making the screen flat  not make important      backend flow.
  or boring."**           delivery information    
                          easy to scan.           

  **"Some buttons have no I found inconsistent    I applied more
  padding. Please fix     button spacing during   consistent button
  that across the         UI review.              spacing and checked
  portals."**                                     other shared interface
                                                  elements for the same
                                                  issue.

  **"Please reduce the    After reviewing the     I refined the
  font size slightly      completed screens, I    typography consistently
  across all portals."**  felt the interface      rather than changing
                          density and typography  individual screens in
                          needed a small          isolation.
                          adjustment.             

  **"Maintain the spacing I wanted the            I preserved the shared
  and styling of the      role-specific portals   design language while
  cooperative portal in   to feel like parts of   keeping the
  the buyer portal."**    the same product even   buyer-specific content
                          though their functions  and actions distinct.
                          are different.          

  **"Make the login       Authentication is       I kept a common login
  screen general because  shared by the different experience and allowed
  it is the login portal  user roles, so I wanted the authenticated
  for all users, and      the login experience to user's role to
  refine the spacing and  remain neutral and      determine the
  design."**              consistent.             appropriate portal.

  **"Now build the admin  At that stage, the      I reviewed the
  portal."**              backend functionality   generated interface
                          for administrative      against the existing
                          operations was already  admin routes and
                          available and I needed  entities, then refined
                          to implement its        the screens to match
                          interface.              the operations
                                                  supported by the
                                                  backend.
  -----------------------------------------------------------------------

### How I worked with AI

I treated AI output as something to review, not something to accept
automatically. A large part of my interaction with AI was iterative: I
would implement or review a screen, notice something that did not fit
the existing system, and ask for a specific correction.

I also used the backend as the source of truth when refining the
frontend. For example, before adding a payment-related section to the
driver portal, I checked whether that responsibility actually belonged
to the driver based on the implemented backend flow.

This helped me use AI for speed without allowing suggestions to
introduce features or responsibilities that were inconsistent with the
system I was building.

------------------------------------------------------------------------

# Cameroonian Context Adaptation

I designed the payment and logistics flow around conditions that are
normal in Cameroon rather than assuming a perfect card-payment and
delivery environment.

Mobile money is central to the payment design. The implementation uses
**Fapshi** as the payment integration layer and keeps its own deposit,
withdrawal, wallet and ledger records so that the application is not
dependent on a single frontend "payment successful" message. Provider
transaction IDs and application-generated external IDs are stored for
reconciliation.

I also treated payment/network uncertainty as a real state. A
cooperative withdrawal can move to `REVIEW_REQUIRED` when the result is
ambiguous instead of immediately refunding or retrying and risking a
duplicate payout. In the same spirit, buyer money can remain protected
in a payment hold until the delivery outcome is known.

The logistics model also reflects local transport realities. A delivery
does not assume one standard vehicle: the system models **motorbikes,
cars, vans, pickups and trucks**, with capacity and availability taken
into account during dispatch. Produce can move from agricultural pickup
locations to buyers in other cities while the driver records meaningful
journey states such as pickup, in transit and delivery reported.

For connectivity, the API uses explicit state transitions rather than
requiring a permanently open real-time connection for the delivery
workflow. A driver can send the next meaningful shipment update when the
application can reach the API, and the backend stores the resulting
shipment event. This does not make the application fully offline-first,
but it avoids making the core delivery process depend on a continuous
socket connection.

------------------------------------------------------------------------

# Going Beyond the Brief

The challenge required a relational schema, order flow, vehicle
allocation, shipment tracking and payment handling. I extended the
solution in a few areas because they solve problems that appear
naturally once the basic workflow is used.

### Protected payment hold

Instead of treating payment as complete settlement, the system separates
the buyer's payment from the cooperative's eventual release. This gives
the order flow room to handle delivery confirmation and disputes.

### Wallet ledger

The wallet does not only store the current balance. Ledger entries
preserve the financial history behind balance changes.

### Inventory reservation

Checkout does not immediately pretend that produce is sold. Inventory
can be reserved temporarily, converted after the order progresses, or
released/expired. This is useful when multiple buyers are interested in
limited produce.

### Dispute flow

A buyer can report a problem and an administrator can resolve the
dispute toward either refunding the buyer or releasing the cooperative's
funds.

### Shipment event history

The current shipment status is not the only tracking information. Events
preserve important transitions such as assignment, pickup, transit,
delivery reporting, delays and failures.

### Transport loads

Shipments can be grouped into a `TransportLoad`. This allows the data
model to represent shared transport without merging separate buyer
orders or their payments.

### Dispatch recommendations

The logistics layer does not model assignment as an arbitrary driver ID
alone. Vehicle capacity, vehicle availability, driver availability and
related eligibility conditions are considered before assignment.

------------------------------------------------------------------------

# API Documentation

The backend includes OpenAPI/Swagger documentation. When the API is
running, use the mounted Swagger interface to explore the available
endpoints and request/response contracts.

The API itself is versioned under:

``` text
/api/v1
```

Health check:

``` http
GET /api/v1/health
```

Main API domains:

``` text
/api/v1/auth
/api/v1/produce
/api/v1/orders
/api/v1/wallet
/api/v1/vehicles
/api/v1/drivers
/api/v1/shipments
/api/v1/disputes
/api/v1/transport-loads
/api/v1/admin
```

------------------------------------------------------------------------

# Running the Project

## Backend prerequisites

-   Node.js
-   PostgreSQL database
-   Fapshi sandbox credentials for payment testing

The backend validates its environment configuration at startup.
Important variables include:

``` env
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:4200

DATABASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FAPSHI_BASE_URL=https://sandbox.fapshi.com
FAPSHI_API_USER=
FAPSHI_API_KEY=

# Separate payout service credentials when cooperative payouts are enabled
FAPSHI_PAYOUT_API_USER=
FAPSHI_PAYOUT_API_KEY=
```

After installing the backend dependencies, generate the Prisma client,
apply the database migrations and start the API using the scripts
defined by the backend project.

## Frontend

Install the Angular application's dependencies and run the development
server. By default, the backend CORS configuration supports a local
Angular origin such as:

``` text
http://localhost:4200
```

Update the frontend API environment/configuration as required for the
deployed backend.

------------------------------------------------------------------------

# Video Pitch

**Maximum length:** 3 minutes

**Video link:**
`ADD_YOUR_UNLISTED_YOUTUBE_OR_PUBLIC_GOOGLE_DRIVE_LINK_HERE`

The video should walk through the actual solution in my own words rather
than trying to demonstrate every screen. I will focus on:

1.  the farm-to-market problem;
2.  the four actors --- buyer, cooperative, driver and admin;
3.  one order moving from produce selection to protected payment and
    shipment;
4.  driver pickup/in-transit/delivery reporting;
5.  buyer confirmation/dispute protection;
6.  the engineering choices that prevent inventory races and driver
    double-booking;
7.  why the payment and transport decisions make sense in the
    Cameroonian context.

------------------------------------------------------------------------

## Final Note

This project started as a challenge about database and API design, but
the interesting part for me was what happens between the obvious steps.

"Buyer places order" sounds simple until two buyers want the last stock.

"Assign a driver" sounds simple until two requests try to assign the
same person.

"Payment successful" sounds simple until a mobile-money provider times
out after the request has already left your server.

"Delivered" sounds simple until the person carrying the goods is also
the person who could benefit from claiming that delivery happened.

Those edge cases shaped the final architecture more than the number of
screens in the application. The result is not meant to pretend that
every farm-to-market problem is solved. It is an implementation of the
core transaction with deliberate controls around the places where trust,
concurrency, payment uncertainty and logistics meet.
