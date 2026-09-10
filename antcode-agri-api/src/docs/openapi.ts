/**
 * OpenAPI 3.0 specification for the AntCode Agri API.
 *
 * This file intentionally lives outside the business modules so Swagger
 * documentation cannot change the already-tested application behavior.
 */
const bearer = [{ bearerAuth: [] }];
const json = (schema: object, example?: object) => ({
  required: true,
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const ok = (description = "Successful response") => ({ description, content: { "application/json": { schema: ref("SuccessResponse") } } });
const created = (description = "Resource created") => ({ description, content: { "application/json": { schema: ref("SuccessResponse") } } });
const errors = {
  400: { description: "Validation or business-rule error", content: { "application/json": { schema: ref("ErrorResponse") } } },
  401: { description: "Authentication required or invalid token", content: { "application/json": { schema: ref("ErrorResponse") } } },
  403: { description: "Authenticated but not authorized for this role/action", content: { "application/json": { schema: ref("ErrorResponse") } } },
  404: { description: "Resource not found", content: { "application/json": { schema: ref("ErrorResponse") } } },
  409: { description: "Conflict with current resource state", content: { "application/json": { schema: ref("ErrorResponse") } } },
  413: { description: "Request body exceeds configured limit", content: { "application/json": { schema: ref("ErrorResponse") } } },
  429: { description: "Rate limit exceeded", content: { "application/json": { schema: ref("ErrorResponse") } } },
};
const uuid = (name: string, description: string) => ({ name, in: "path", required: true, description, schema: { type: "string", format: "uuid" } });
const pagination = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
  { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
];
const adminPagination = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
  { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
];

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AntCode Agri API",
    version: "1.0.0",
    description: "Farm-to-market supply-chain API for Cameroon. It connects buyers, cooperatives, drivers and operations, with protected payment holds, Smart Dispatch, shared transport loads, delivery verification, settlement, disputes and Fapshi-backed collections/payouts. Fapshi is the payment provider; the platform implements the escrow-style hold/release workflow.",
  },
  servers: [
    { url: "http://localhost:4000", description: "Local development" },
  ],
  tags: [
    { name: "Health" }, { name: "Authentication" }, { name: "Produce" }, { name: "Orders" },
    { name: "Wallet" }, { name: "Vehicles" }, { name: "Drivers" }, { name: "Shipments" },
    { name: "Disputes" }, { name: "Transport Loads" }, { name: "Admin / Operations" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste the access token returned by POST /api/v1/auth/login." },
    },
    schemas: {
      SuccessResponse: { type: "object", required: ["success", "message"], properties: { success: { type: "boolean", example: true }, message: { type: "string" }, data: { type: "object", additionalProperties: true } } },
      ErrorResponse: { type: "object", required: ["success", "message"], properties: { success: { type: "boolean", example: false }, message: { type: "string" }, errors: { type: "array", items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } } } } },
      BuyerRegistration: { type: "object", required: ["fullName","phone","password","buyerType","city"], properties: { fullName:{type:"string",minLength:2,maxLength:120}, phone:{type:"string",example:"+237670000001"}, email:{type:"string",format:"email"}, password:{type:"string",format:"password",minLength:8}, buyerType:{type:"string",enum:["INDIVIDUAL","RESTAURANT","HOTEL","RETAILER","WHOLESALER","FOOD_PROCESSOR","OTHER"]}, businessName:{type:"string"}, city:{type:"string",example:"Douala"}, deliveryAddress:{type:"string"} } },
      CooperativeRegistration: { type:"object", required:["fullName","phone","password","name","city"], properties:{ fullName:{type:"string"}, phone:{type:"string",example:"+237670000002"}, email:{type:"string",format:"email"}, password:{type:"string",format:"password"}, name:{type:"string"}, description:{type:"string"}, region:{type:"string"}, city:{type:"string"}, locality:{type:"string"} } },
      DriverRegistration: { type:"object", required:["fullName","phone","password"], properties:{ fullName:{type:"string"}, phone:{type:"string",example:"+237670000003"}, email:{type:"string",format:"email"}, password:{type:"string",format:"password"}, licenseNumber:{type:"string"}, city:{type:"string"} } },
      Login: { type:"object", required:["identifier","password"], properties:{ identifier:{type:"string",example:"buyer@example.com"}, password:{type:"string",format:"password",example:"TestPassword123"} } },
      RefreshToken: { type:"object", required:["refreshToken"], properties:{ refreshToken:{type:"string"} } },
      ProduceCreate: { type:"object", required:["name","pricePerKg","totalQuantityKg","harvestDate","originCity"], properties:{ name:{type:"string",example:"Fresh Tomatoes"}, description:{type:"string"}, pricePerKg:{type:"number",example:625}, totalQuantityKg:{type:"number",example:100}, harvestDate:{type:"string",format:"date-time"}, originCity:{type:"string",example:"Foumbot"}, pickupLocation:{type:"string"} } },
      ProduceUpdate: { type:"object", minProperties:1, properties:{ name:{type:"string"}, description:{type:"string",nullable:true}, pricePerKg:{type:"number"}, totalQuantityKg:{type:"number"}, harvestDate:{type:"string",format:"date-time"}, originCity:{type:"string"}, pickupLocation:{type:"string",nullable:true} } },
      OrderCreate: { type:"object", required:["listingId","quantityKg","deliveryCity","deliveryAddress"], properties:{ listingId:{type:"string",format:"uuid"}, quantityKg:{type:"number",example:10}, deliveryCity:{type:"string",example:"Douala"}, deliveryAddress:{type:"string",example:"Akwa"} } },
      Deposit: { type:"object", required:["amount","phone"], properties:{ amount:{type:"integer",minimum:100,example:20000}, phone:{type:"string",example:"670000000"}, medium:{type:"string",enum:["mobile money","orange money"]} } },
      Withdrawal: { type:"object", required:["amount","phone"], properties:{ amount:{type:"integer",minimum:100,example:1000}, phone:{type:"string",example:"670000000"}, medium:{type:"string",enum:["mobile money","orange money"]} } },
      VehicleCreate: { type:"object", required:["registrationNo","type","capacityKg"], properties:{ registrationNo:{type:"string",example:"LT-458-AA"}, type:{type:"string",enum:["MOTORBIKE","CAR","VAN","PICKUP","TRUCK"]}, capacityKg:{type:"number",example:3000}, currentCity:{type:"string",example:"Douala"} } },
      VehicleUpdate: { type:"object", minProperties:1, properties:{ registrationNo:{type:"string"}, type:{type:"string",enum:["MOTORBIKE","CAR","VAN","PICKUP","TRUCK"]}, capacityKg:{type:"number"}, currentCity:{type:"string",nullable:true} } },
      ShipmentEvent: { type:"object", properties:{ city:{type:"string"}, note:{type:"string",maxLength:500} } },
      DisputeCreate: { type:"object", required:["reason"], properties:{ reason:{type:"string",minLength:10,maxLength:1000} } },
      DisputeResolve: { type:"object", required:["resolution","adminNote"], properties:{ resolution:{type:"string",enum:["REFUND_BUYER","RELEASE_COOPERATIVE"]}, adminNote:{type:"string",minLength:3,maxLength:1000} } },
      TransportLoadCreate: { type:"object", required:["vehicleId","shipmentIds"], properties:{ vehicleId:{type:"string",format:"uuid"}, shipmentIds:{type:"array",minItems:2,maxItems:20,uniqueItems:true,items:{type:"string",format:"uuid"}} } },
    },
  },
  paths: {
    "/api/v1/health": { get: { tags:["Health"], summary:"API health check", responses:{ 200:ok("API is healthy") } } },
    "/api/v1/auth/register/buyer": { post:{ tags:["Authentication"], summary:"Register buyer", requestBody:json(ref("BuyerRegistration")), responses:{201:created("Buyer account created"),...errors} } },
    "/api/v1/auth/register/cooperative": { post:{ tags:["Authentication"], summary:"Register cooperative", description:"Creates a cooperative account pending administrator verification.", requestBody:json(ref("CooperativeRegistration")), responses:{201:created("Cooperative registration submitted"),...errors} } },
    "/api/v1/auth/register/driver": { post:{ tags:["Authentication"], summary:"Register driver", description:"Creates a driver account pending verification.", requestBody:json(ref("DriverRegistration")), responses:{201:created("Driver registration submitted"),...errors} } },
    "/api/v1/auth/login": { post:{ tags:["Authentication"], summary:"Login", description:"Returns access and refresh tokens. Authentication endpoints have a stricter rate limit.", requestBody:json(ref("Login")), responses:{200:ok("Login successful"),...errors} } },
    "/api/v1/auth/refresh": { post:{ tags:["Authentication"], summary:"Refresh access token", requestBody:json(ref("RefreshToken")), responses:{200:ok("Access token refreshed"),...errors} } },
    "/api/v1/auth/me": { get:{ tags:["Authentication"], summary:"Get current user", security:bearer, responses:{200:ok(),...errors} } },

    "/api/v1/produce": {
      get:{ tags:["Produce"], summary:"Browse active marketplace produce", parameters:[{name:"name",in:"query",schema:{type:"string"}},{name:"city",in:"query",schema:{type:"string"}},{name:"minPrice",in:"query",schema:{type:"number",minimum:0}},{name:"maxPrice",in:"query",schema:{type:"number",minimum:0}},{name:"sort",in:"query",schema:{type:"string",enum:["newest","price_asc","price_desc","harvest_asc","harvest_desc"],default:"newest"}},...pagination], responses:{200:ok(),...errors} },
      post:{ tags:["Produce"], summary:"Create produce listing", description:"COOPERATIVE only.", security:bearer, requestBody:json(ref("ProduceCreate")), responses:{201:created(),...errors} },
    },
    "/api/v1/produce/mine": { get:{ tags:["Produce"], summary:"List my cooperative produce", security:bearer, parameters:[{name:"status",in:"query",schema:{type:"string",enum:["DRAFT","ACTIVE","PAUSED","SOLD_OUT","EXPIRED"]}},...pagination], responses:{200:ok(),...errors} } },
    "/api/v1/produce/{id}": { get:{tags:["Produce"],summary:"Get produce listing",parameters:[uuid("id","Produce listing ID")],responses:{200:ok(),...errors}}, patch:{tags:["Produce"],summary:"Update my produce listing",security:bearer,parameters:[uuid("id","Produce listing ID")],requestBody:json(ref("ProduceUpdate")),responses:{200:ok(),...errors}}, delete:{tags:["Produce"],summary:"Remove my produce listing",security:bearer,parameters:[uuid("id","Produce listing ID")],responses:{200:ok(),...errors}} },
    "/api/v1/produce/{id}/status": { patch:{tags:["Produce"],summary:"Change produce listing status",security:bearer,parameters:[uuid("id","Produce listing ID")],requestBody:json({type:"object",required:["status"],properties:{status:{type:"string",enum:["DRAFT","ACTIVE","PAUSED","SOLD_OUT","EXPIRED"]}}}),responses:{200:ok(),...errors}} },

    "/api/v1/orders": { post:{tags:["Orders"],summary:"Create order and reserve inventory",description:"BUYER only.",security:bearer,requestBody:json(ref("OrderCreate")),responses:{201:created(),...errors}}, get:{tags:["Orders"],summary:"List my orders",security:bearer,parameters:[{name:"status",in:"query",schema:{type:"string"}},...pagination],responses:{200:ok(),...errors}} },
    "/api/v1/orders/{id}": { get:{tags:["Orders"],summary:"Get my order",security:bearer,parameters:[uuid("id","Order ID")],responses:{200:ok(),...errors}} },
    "/api/v1/orders/{id}/pay": { post:{tags:["Orders"],summary:"Secure order payment from buyer wallet",description:"Moves funds from available to held balance and creates an ACTIVE payment hold.",security:bearer,parameters:[uuid("id","Order ID")],responses:{200:ok(),...errors}} },
    "/api/v1/orders/{id}/confirm-delivery": { post:{tags:["Orders"],summary:"Confirm delivery and release settlement",description:"BUYER confirms a driver-reported delivery; held funds are released to the cooperative.",security:bearer,parameters:[uuid("id","Order ID")],responses:{200:ok(),...errors}} },
    "/api/v1/orders/{id}/cancel": { post:{tags:["Orders"],summary:"Cancel my eligible order",security:bearer,parameters:[uuid("id","Order ID")],responses:{200:ok(),...errors}} },

    "/api/v1/wallet": { get:{tags:["Wallet"],summary:"Get my wallet and ledger",description:"BUYER or COOPERATIVE.",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/wallet/deposits": { get:{tags:["Wallet"],summary:"List buyer deposits",security:bearer,parameters:pagination,responses:{200:ok(),...errors}} },
    "/api/v1/wallet/deposits/direct-pay": { post:{tags:["Wallet"],summary:"Request Fapshi Direct Pay deposit",description:"BUYER only. Uses server-side Fapshi collection credentials.",security:bearer,requestBody:json(ref("Deposit")),responses:{201:created(),...errors}} },
    "/api/v1/wallet/deposits/{id}/sync": { post:{tags:["Wallet"],summary:"Synchronize deposit status",security:bearer,parameters:[uuid("id","Wallet deposit ID")],responses:{200:ok(),...errors}} },
    "/api/v1/wallet/withdrawals": { get:{tags:["Wallet"],summary:"List cooperative withdrawals",security:bearer,parameters:pagination,responses:{200:ok(),...errors}}, post:{tags:["Wallet"],summary:"Request cooperative payout",description:"COOPERATIVE only. The cooperative must be VERIFIED. Funds are atomically debited before the Fapshi payout request.",security:bearer,requestBody:json(ref("Withdrawal")),responses:{201:created(),...errors}} },
    "/api/v1/wallet/withdrawals/{id}/sync": { post:{tags:["Wallet"],summary:"Synchronize payout status",description:"Terminal synchronization is idempotent. Failed/expired payouts refund the platform wallet once.",security:bearer,parameters:[uuid("id","Wallet withdrawal ID")],responses:{200:ok(),...errors}} },

    "/api/v1/vehicles": { post:{tags:["Vehicles"],summary:"Create my vehicle",description:"DRIVER only.",security:bearer,requestBody:json(ref("VehicleCreate")),responses:{201:created(),...errors}} },
    "/api/v1/vehicles/mine": { get:{tags:["Vehicles"],summary:"List my vehicles",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/vehicles/{id}": { patch:{tags:["Vehicles"],summary:"Update my vehicle",security:bearer,parameters:[uuid("id","Vehicle ID")],requestBody:json(ref("VehicleUpdate")),responses:{200:ok(),...errors}} },
    "/api/v1/vehicles/{id}/availability": { patch:{tags:["Vehicles"],summary:"Update vehicle availability",security:bearer,parameters:[uuid("id","Vehicle ID")],requestBody:json({type:"object",required:["isAvailable"],properties:{isAvailable:{type:"boolean"}}}),responses:{200:ok(),...errors}} },
    "/api/v1/drivers/me/availability": { patch:{tags:["Drivers"],summary:"Update my driver availability",security:bearer,requestBody:json({type:"object",required:["isAvailable"],properties:{isAvailable:{type:"boolean"}}}),responses:{200:ok(),...errors}} },

    "/api/v1/shipments/orders/{orderId}": { post:{tags:["Shipments"],summary:"Create shipment for paid order",description:"BUYER only.",security:bearer,parameters:[uuid("orderId","Order ID")],responses:{201:created(),...errors}} },
    "/api/v1/shipments/mine": { get:{tags:["Shipments"],summary:"List my assigned shipments",description:"DRIVER only.",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/shipments/{id}/dispatch-recommendations": { get:{tags:["Shipments"],summary:"Get Smart Dispatch recommendations",description:"ADMIN only. Deterministic scoring considers capacity utilization, pickup proximity, perishability urgency and route familiarity.",security:bearer,parameters:[uuid("id","Shipment ID")],responses:{200:ok(),...errors}} },
    "/api/v1/shipments/{id}/assign": { patch:{tags:["Shipments"],summary:"Assign vehicle/driver to shipment",description:"ADMIN only. Assignment uses atomic availability claims to prevent double booking.",security:bearer,parameters:[uuid("id","Shipment ID")],requestBody:json({type:"object",required:["vehicleId"],properties:{vehicleId:{type:"string",format:"uuid"}}}),responses:{200:ok(),...errors}} },
    "/api/v1/shipments/{id}/pickup": { patch:{tags:["Shipments"],summary:"Mark shipment picked up",description:"DRIVER only.",security:bearer,parameters:[uuid("id","Shipment ID")],requestBody:json(ref("ShipmentEvent")),responses:{200:ok(),...errors}} },
    "/api/v1/shipments/{id}/in-transit": { patch:{tags:["Shipments"],summary:"Start shipment transit",description:"DRIVER only.",security:bearer,parameters:[uuid("id","Shipment ID")],requestBody:json(ref("ShipmentEvent")),responses:{200:ok(),...errors}} },
    "/api/v1/shipments/{id}/report-delivery": { patch:{tags:["Shipments"],summary:"Report delivery",description:"DRIVER only. Buyer must subsequently confirm delivery or open a dispute.",security:bearer,parameters:[uuid("id","Shipment ID")],requestBody:json(ref("ShipmentEvent")),responses:{200:ok(),...errors}} },

    "/api/v1/disputes/orders/{id}": { post:{tags:["Disputes"],summary:"Open delivery dispute",description:"BUYER only. Freezes the ACTIVE payment hold in DISPUTED state.",security:bearer,parameters:[uuid("id","Order ID")],requestBody:json(ref("DisputeCreate")),responses:{201:created(),...errors}} },
    "/api/v1/disputes/mine": { get:{tags:["Disputes"],summary:"List my buyer disputes",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/disputes": { get:{tags:["Disputes"],summary:"List disputes for operations",description:"ADMIN only.",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/disputes/{id}/resolve": { patch:{tags:["Disputes"],summary:"Resolve dispute",description:"ADMIN can refund buyer or release funds to cooperative.",security:bearer,parameters:[uuid("id","Dispute ID")],requestBody:json(ref("DisputeResolve")),responses:{200:ok(),...errors}} },

    "/api/v1/transport-loads": { post:{tags:["Transport Loads"],summary:"Create shared transport load",description:"ADMIN only. Pools 2–20 compatible unassigned shipments onto one available vehicle.",security:bearer,requestBody:json(ref("TransportLoadCreate")),responses:{201:created(),...errors}}, get:{tags:["Transport Loads"],summary:"List transport loads",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/transport-loads/{id}": { get:{tags:["Transport Loads"],summary:"Get shared transport load",security:bearer,parameters:[uuid("id","Transport load ID")],responses:{200:ok(),...errors}} },

    "/api/v1/admin/dashboard": { get:{tags:["Admin / Operations"],summary:"Operations dashboard",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/admin/operations/alerts": { get:{tags:["Admin / Operations"],summary:"Operational alerts",security:bearer,responses:{200:ok(),...errors}} },
    "/api/v1/admin/orders": { get:{tags:["Admin / Operations"],summary:"List all orders",security:bearer,parameters:[...adminPagination,{name:"status",in:"query",schema:{type:"string"}}],responses:{200:ok(),...errors}} },
    "/api/v1/admin/orders/{id}": { get:{tags:["Admin / Operations"],summary:"Get full order operations detail",security:bearer,parameters:[uuid("id","Order ID")],responses:{200:ok(),...errors}} },
    "/api/v1/admin/shipments": { get:{tags:["Admin / Operations"],summary:"List all shipments",security:bearer,parameters:[...adminPagination,{name:"status",in:"query",schema:{type:"string"}}],responses:{200:ok(),...errors}} },
    "/api/v1/admin/shipments/{id}": { get:{tags:["Admin / Operations"],summary:"Get shipment operations detail",security:bearer,parameters:[uuid("id","Shipment ID")],responses:{200:ok(),...errors}} },
    "/api/v1/admin/cooperatives": { get:{tags:["Admin / Operations"],summary:"List cooperatives",security:bearer,parameters:[...adminPagination,{name:"verificationStatus",in:"query",schema:{type:"string"}},{name:"city",in:"query",schema:{type:"string"}}],responses:{200:ok(),...errors}} },
    "/api/v1/admin/cooperatives/{id}": { get:{tags:["Admin / Operations"],summary:"Get cooperative operations detail",security:bearer,parameters:[uuid("id","Cooperative profile ID")],responses:{200:ok(),...errors}} },
    "/api/v1/admin/drivers": { get:{tags:["Admin / Operations"],summary:"List drivers",security:bearer,parameters:[...adminPagination,{name:"verificationStatus",in:"query",schema:{type:"string"}},{name:"isAvailable",in:"query",schema:{type:"boolean"}},{name:"city",in:"query",schema:{type:"string"}}],responses:{200:ok(),...errors}} },
    "/api/v1/admin/vehicles": { get:{tags:["Admin / Operations"],summary:"List vehicles",security:bearer,parameters:[...adminPagination,{name:"status",in:"query",schema:{type:"string"}},{name:"isAvailable",in:"query",schema:{type:"boolean"}},{name:"city",in:"query",schema:{type:"string"}}],responses:{200:ok(),...errors}} },
    "/api/v1/admin/withdrawals": { get:{tags:["Admin / Operations"],summary:"List cooperative withdrawals/payouts",security:bearer,parameters:[...adminPagination,{name:"status",in:"query",schema:{type:"string",enum:["PROCESSING","SUCCESSFUL","FAILED","REVIEW_REQUIRED"]}}],responses:{200:ok(),...errors}} },
  },
} as const;
