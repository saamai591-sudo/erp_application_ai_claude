# Schema `CTM`

## Tables

### CTM.Order

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | CustomerID | bigint | N |  |  |
| 5 | AddressID | int | Y |  |  |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | Status | tinyint | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | SaleTypeID | int | N |  |  |
| 15 | SaleAreaID | int | Y |  |  |

- **Primary key:** OrderID
- **FK** `FK_Order_SaleArea` (SaleAreaID) -> SLE.SaleArea (SaleAreaID)
- **FK** `FK_Order_AddressID` (AddressID) -> CFG.Address (AddressID)
- **FK** `FK_Order_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Order_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Order_Customer` (CustomerID) -> CFG.Party (PartyID)
- **FK** `FK_Order_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Order_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedSaleInvoice_SaleType` (SaleTypeID) -> SLE.SaleType (SaleTypeID)
- **Referenced by:** CTM.OrderItem (OrderID); CTM.OrderSaleAgent (OrderID)

### CTM.OrderItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderItemID | int | N |  | identity |
| 2 | OrderID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(256) | Y |  |  |
| 8 | Description2 | nvarchar(256) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** OrderItemID
- **FK** `FK_OrderItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderItem_Order` (OrderID) -> CTM.Order (OrderID) on delete CASCADE
- **FK** `FK_OrderItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** CTM.OrderItemTrace (OrderItemID); REQ.PurchaseRequestItem (OrderItemID); SLE.JustificationItem (OrderItemID); SLE.QuotationItem (OrderItemID)

### CTM.OrderItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderItemTraceID | int | N |  | identity |
| 2 | OrderItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** OrderItemTraceID
- **unique index** `IX_OrderItemTrace` (OrderItemID, TraceID)
- **FK** `FK_OrderItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_OrderItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_OrderItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderItemTrace_OrderItem` (OrderItemID) -> CTM.OrderItem (OrderItemID) on delete CASCADE
- **FK** `FK_OrderItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### CTM.OrderSaleAgent

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderSaleAgentID | int | N |  | identity |
| 2 | OrderID | int | N |  |  |
| 3 | SaleAgentID | bigint | N |  |  |
| 4 | Description | nvarchar(256) | Y |  |  |
| 5 | Description2 | nvarchar(256) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** OrderSaleAgentID
- **FK** `FK_OrderSaleAgent_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderSaleAgent_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderSaleAgent_Order` (OrderID) -> CTM.Order (OrderID) on delete CASCADE
- **FK** `FK_OrderSaleAgent_SaleAgent` (SaleAgentID) -> CFG.Party (PartyID)

### CTM.Reception

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | CustomerID | bigint | N |  |  |
| 5 | AddressID | int | Y |  |  |
| 6 | PhoneID | int | Y |  |  |
| 7 | BranchID | int | N |  |  |
| 8 | ReceptionTypeID | int | N |  |  |
| 9 | FinancialPeriodID | int | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceptionID
- **FK** `FK_Reception_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Reception_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Reception_Customer` (CustomerID) -> CFG.Party (PartyID)
- **FK** `FK_Reception_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Reception_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Reception_Phone` (PhoneID) -> CFG.Phone (PhoneID)
- **FK** `FK_Reception_ReceptionType` (ReceptionTypeID) -> CTM.ReceptionType (ReceptionTypeID)
- **FK** `FK_Reception_Address` (AddressID) -> CFG.Address (AddressID)
- **Referenced by:** CTM.ReceptionItem (ReceptionID); CTM.ReceptionTrace (ReceptionID); SLE.InvoiceItem (ReceptionID); STC.OutgoingItem (ReceptionID); STC.TemporaryOutgoingItem (ReceptionID)

### CTM.ReceptionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionItemID | int | N |  | identity |
| 2 | ReceptionID | int | N |  |  |
| 3 | InvoiceItemID | int | Y |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | Quantity | decimal(30,4) | N |  |  |
| 6 | Description | nvarchar(1050) | Y |  |  |
| 7 | Description2 | nvarchar(1050) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceptionItemID
- **FK** `FK_ReceptionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceptionItem_InvoiceItem` (InvoiceItemID) -> SLE.InvoiceItem (InvoiceItemID)
- **FK** `FK_ReceptionItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceptionItem_Reception` (ReceptionID) -> CTM.Reception (ReceptionID) on delete CASCADE
- **FK** `FK_ReceptionItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** CTM.ReceptionItemTrace (ReceptionItemID)

### CTM.ReceptionItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionItemTraceID | int | N |  | identity |
| 2 | ReceptionItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReceptionItemTraceID
- **unique index** `IX_ReceptionItemTrace` (ReceptionItemID, TraceID)
- **FK** `FK_ReceptionItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceptionItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReceptionItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceptionItemTrace_ReceptionItem` (ReceptionItemID) -> CTM.ReceptionItem (ReceptionItemID) on delete CASCADE
- **FK** `FK_ReceptionItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ReceptionItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### CTM.ReceptionStatus

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionStatusID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | IsEnd | bit | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceptionStatusID
- **FK** `FK_ReceptionStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceptionStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.ReceptionTrace (ReceptionStatusID)

### CTM.ReceptionTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionTraceID | int | N |  | identity |
| 2 | ReceptionID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | ReceptionStatusID | int | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | Description2 | nvarchar(MAX) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceptionTraceID
- **FK** `FK_ReceptionTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceptionTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceptionTrace_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ReceptionTrace_Reception` (ReceptionID) -> CTM.Reception (ReceptionID)
- **FK** `FK_ReceptionTrace_ReceptionStatus` (ReceptionStatusID) -> CTM.ReceptionStatus (ReceptionStatusID)

### CTM.ReceptionType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceptionTypeID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceptionTypeID
- **FK** `FK_ReceptionType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceptionType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.Reception (ReceptionTypeID)

### CTM.ShoppingCart

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ShoppingCartID | int | N |  | identity |
| 2 | FromSerialNumber | int | N |  |  |
| 3 | ToSerialNumber | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | IssueDate | date | N |  |  |
| 7 | ExpireDate | date | N |  |  |
| 8 | Description | nvarchar(MAX) | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |

- **Primary key:** ShoppingCartID
- **FK** `FK_ShoppingCart_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ShoppingCart_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ShoppingCart_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** POS.PosReceiptItem (ShoppingCartID)

### CTM.SubscribeCard

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SubscribeCardID | int | N |  | identity |
| 2 | PartyID | bigint | N |  |  |
| 3 | Number | nvarchar(50) | N |  |  |
| 4 | Password | nvarchar(512) | N |  |  |
| 5 | IssueDate | date | N |  |  |
| 6 | ExpireDate | date | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** SubscribeCardID
- **FK** `FK_SubscribeCard_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_SubscribeCard_User` (Creator) -> CFG.User (UserID)
- **FK** `FK_SubscribeCard_User1` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.SubscribeCardCharge (SubscribeCardID)

### CTM.SubscribeCardCharge

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SubscribeCardChargeID | int | N |  | identity |
| 2 | SubscribeCardID | int | N |  |  |
| 3 | SubscribeCardChargeTypeID | int | N |  |  |
| 4 | ChargeDate | date | N |  |  |
| 5 | ExpireDate | date | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** SubscribeCardChargeID
- **FK** `FK_SubscribeCardCharge_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SubscribeCardCharge_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SubscribeCardCharge_SubscribeCard` (SubscribeCardID) -> CTM.SubscribeCard (SubscribeCardID)
- **FK** `FK_SubscribeCardCharge_SubscribeCardChargeType` (SubscribeCardChargeTypeID) -> CTM.SubscribeCardChargeType (SubscribeCardChargeTypeID)
- **Referenced by:** POS.PosReceiptItem (SubscribeCardChargeID)

### CTM.SubscribeCardChargeType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SubscribeCardChargeTypeID | int | N |  | identity |
| 2 | Code | nvarchar(50) | N |  |  |
| 3 | Title | nvarchar(128) | N |  |  |
| 4 | ItemType | tinyint | N |  |  |
| 5 | OnlyOnce | bit | N |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | CurrentSlID | int | N |  |  |
| 8 | YearsSlID | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** SubscribeCardChargeTypeID
- **FK** `FK_SubscribeCardChargeType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SubscribeCardChargeType_lastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.SubscribeCardCharge (SubscribeCardChargeTypeID)

## Views

### CTM.Order_Invoice

Definition: `programmability/views/CTM.Order_Invoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | InvoiceItemID | int | N |

### CTM.Order_Non_Request

Definition: `programmability/views/CTM.Order_Non_Request.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | SubQuantity | decimal(30,4) | Y |
| 4 | DoReqMain | decimal(38,4) | Y |
| 5 | OutMianQuantity | decimal(38,4) | Y |
| 6 | RemittanceMianQuantity | decimal(38,4) | Y |
| 7 | Non | decimal(38,4) | Y |
| 8 | NonSub | decimal(38,4) | Y |

### CTM.Order_Outgoing

Definition: `programmability/views/CTM.Order_Outgoing.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | OutgoingItemID | int | N |

### CTM.Order_Quotation

Definition: `programmability/views/CTM.Order_Quotation.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | Y |
| 2 | QuotationItemID | int | N |

### CTM.Order_Remittance

Definition: `programmability/views/CTM.Order_Remittance.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | RemittanceItemID | int | N |

### CTM.Order_ReturnedSaleInvoice

Definition: `programmability/views/CTM.Order_ReturnedSaleInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | ReturnedSaleInvoiceItemID | int | N |

### CTM.Order_ReturnedSaleJustification

Definition: `programmability/views/CTM.Order_ReturnedSaleJustification.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | OrderItemID | int | N |
| 2 | ReturnedSaleJustificationItemID | int | N |

