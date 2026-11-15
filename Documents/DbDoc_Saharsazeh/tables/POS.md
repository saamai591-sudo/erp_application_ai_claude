# Schema `POS`

## Tables

### POS.ActivityTime

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityTimeID | int | N |  | identity |
| 2 | Title | nvarchar(128) | N |  |  |
| 3 | Title2 | nvarchar(128) | N |  |  |
| 4 | Code | int | N |  |  |
| 5 | TimeInfo | nvarchar(4000) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ActivityTimeID
- **FK** `FK_ActivityTime_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ActivityTime_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** POS.StationShift (ActivityTimeID)

### POS.CardReader

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CardReaderID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Number | varchar(128) | N |  |  |
| 5 | BankAccountID | int | N |  |  |
| 6 | SlID | int | N |  |  |
| 7 | DlID | bigint | N |  |  |
| 8 | IsActive | bit | N | ((1)) |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | AcceptorNumber | nvarchar(50) | N |  |  |

- **Primary key:** CardReaderID
- **FK** `FK_CardReader_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_CardReader_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CardReader_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CardReader_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CardReader_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **Referenced by:** POS.PosReceiptItem (CardReaderID); POS.StationCardReader (CardReaderID)

### POS.CardReaderSettlement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CardReaderSettlementID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Description | nvarchar(2048) | N |  |  |
| 6 | Description2 | nvarchar(2048) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | ToDate | date | Y |  |  |

- **Primary key:** CardReaderSettlementID
- **Referenced by:** FIN.ReceiveSubject (CardReaderSettlementID); POS.CardReaderSettlementItem (CardReaderSettlementID)

### POS.CardReaderSettlementItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CardReaderSettlementItemID | int | N |  | identity |
| 2 | CardReaderSettlementID | int | N |  |  |
| 3 | PosReceiptItemID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CardReaderSettlementItemID
- **FK** `FK_CardReaderSettlementItem_CardReaderSettlement` (CardReaderSettlementID) -> POS.CardReaderSettlement (CardReaderSettlementID) on delete CASCADE
- **FK** `FK_CardReaderSettlementItem_PosReceiptItem` (PosReceiptItemID) -> POS.PosReceiptItem (PosReceiptItemID)

### POS.DeliverCheque

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliverChequeID | int | N |  | identity |
| 2 | StationShiftID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | CashID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DeliverChequeID
- **FK** `FK_DeliverCheque_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_DeliverCheque_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DeliverCheque_StationShift` (StationShiftID) -> POS.StationShift (StationShiftID)
- **FK** `FK_DeliverCheque_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.ReceiveReceipt (DeliverChequeID); POS.DeliverChequeItem (DeliverChequeID)

### POS.DeliverChequeItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliverChequeItemID | int | N |  | identity |
| 2 | DeliverChequeID | int | N |  |  |
| 3 | PosReceiptItemID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DeliverChequeItemID
- **FK** `FK_DeliverChequeItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DeliverChequeItem_PosReceiptItem` (PosReceiptItemID) -> POS.PosReceiptItem (PosReceiptItemID)
- **FK** `FK_DeliverChequeItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DeliverChequeItem_DeliverCheque` (DeliverChequeID) -> POS.DeliverCheque (DeliverChequeID) on delete CASCADE

### POS.Delivery

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliveryID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | StationShiftID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PreVoucherID | int | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Status | tinyint | N | ((1)) |  |
| 13 | OutgoingID | int | Y |  |  |
| 14 | ReturnedOutgoingID | int | Y |  |  |

- **Primary key:** DeliveryID
- **FK** `FK_Delivery_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Delivery_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID)
- **FK** `FK_Delivery_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Delivery_ReturnedOutgoing` (ReturnedOutgoingID) -> STC.ReturnedOutgoing (ReturnedOutgoingID)
- **FK** `FK_Delivery_StationShift` (StationShiftID) -> POS.StationShift (StationShiftID)
- **Referenced by:** POS.DeliveryPosInvoice (DeliveryID); POS.DeliveryPosReceiptItem (DeliveryID)

### POS.DeliveryPosInvoice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliveryPosInvoiceID | int | N |  | identity |
| 2 | DeliveryID | int | N |  |  |
| 3 | PosInvoiceID | int | N |  |  |
| 4 | Status | tinyint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** DeliveryPosInvoiceID
- **FK** `FK_DeliveryPosInvoice_Delivery` (DeliveryID) -> POS.Delivery (DeliveryID) on delete CASCADE
- **FK** `FK_DeliveryPosInvoice_PosInvoice` (PosInvoiceID) -> POS.PosInvoice (PosInvoiceID)

### POS.DeliveryPosReceiptItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliveryPosReceiptItemID | int | N |  | identity |
| 2 | DeliveryID | int | N |  |  |
| 3 | PosReceiptItemID | int | N |  |  |
| 4 | State | tinyint | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DeliveryPosReceiptItemID
- **FK** `FK_DeliveryPosReceiptItem_Delivery` (DeliveryID) -> POS.Delivery (DeliveryID) on delete CASCADE
- **FK** `FK_DeliveryPosReceiptItem_PosReceiptItem` (PosReceiptItemID) -> POS.PosReceiptItem (PosReceiptItemID)

### POS.InstallmentAccumulation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstallmentAccumulationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | FinancialPeriodID | int | N |  |  |

- **Primary key:** InstallmentAccumulationID
- **FK** `FK_InstallmentAccumulation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulation_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **Referenced by:** POS.InstallmentAccumulationCalculation (InstallmentAccumulationID); POS.InstallmentAccumulationItem (InstallmentAccumulationID)

### POS.InstallmentAccumulationCalculation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstallmentAccumulationCalculationID | int | N |  | identity |
| 2 | InstallmentAccumulationID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | TotalAmount | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** InstallmentAccumulationCalculationID
- **FK** `FK_InstallmentAccumulationCalculation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulationCalculation_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulationCalculation_InstallmentAccumulation` (InstallmentAccumulationID) -> POS.InstallmentAccumulation (InstallmentAccumulationID)
- **FK** `FK_InstallmentAccumulationCalculation_Party` (PartyID) -> CFG.Party (PartyID)

### POS.InstallmentAccumulationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstallmentAccumulationItemID | int | N |  | identity |
| 2 | InstallmentAccumulationID | int | N |  |  |
| 3 | PosInvoiceId | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** InstallmentAccumulationItemID
- **FK** `FK_InstallmentAccumulationItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulationItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InstallmentAccumulationItem_InstallmentAccumulation` (InstallmentAccumulationID) -> POS.InstallmentAccumulation (InstallmentAccumulationID) on delete CASCADE
- **FK** `FK_InstallmentAccumulationItem_PosInvoice` (PosInvoiceId) -> POS.PosInvoice (PosInvoiceID)

### POS.OrderFood

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderFoodID | int | N |  | identity |
| 2 | StationShiftID | int | N |  |  |
| 3 | RestaurantTableID | int | Y |  |  |
| 4 | SubscriptionID | int | Y |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | Number | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Date | datetime | N |  |  |
| 13 | Status | tinyint | N |  |  |

- **Primary key:** OrderFoodID
- **FK** `FK_OrderFood_RestaurantTable` (RestaurantTableID) -> POS.RestaurantTable (RestaurantTableID)
- **FK** `FK_OrderFood_Subscription` (SubscriptionID) -> POS.Subscription (SubscriptionID)
- **FK** `FK_OrderFood_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderFood_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderFood_StationShift` (StationShiftID) -> POS.StationShift (StationShiftID) on delete CASCADE
- **Referenced by:** POS.OrderFoodItem (OrderFoodID)

### POS.OrderFoodItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderFoodItemID | int | N |  | identity |
| 2 | OrderFoodID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Description | nvarchar(256) | Y |  |  |
| 12 | Description2 | nvarchar(256) | Y |  |  |
| 13 | PrintedMainQuantity | decimal(30,4) | N | ((0)) |  |

- **Primary key:** OrderFoodItemID
- **FK** `FK_OrderFoodItem_OrderFood` (OrderFoodID) -> POS.OrderFood (OrderFoodID) on delete CASCADE
- **FK** `FK_OrderFoodItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_OrderFoodItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderFoodItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** POS.PosInvoiceItem (OrderFoodItemID)

### POS.PosInvoice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PosInvoiceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | IsReturnInvoice | bit | N | ((0)) |  |
| 6 | StateShiftID | int | N |  |  |
| 7 | StockID | int | Y |  |  |
| 8 | CustomerID | bigint | N |  |  |
| 9 | TotalPrice | decimal(30,4) | N |  |  |
| 10 | TotalDiscount | decimal(30,4) | N |  |  |
| 11 | TotalNetPrice | decimal(30,4) | N |  |  |
| 12 | TotalTax | decimal(30,4) | N |  |  |
| 13 | TotalDuty | decimal(30,4) | N |  |  |
| 14 | HasInstallment | bit | N | ((0)) |  |
| 15 | HasCredit | bit | N | ((0)) |  |
| 16 | Version | int | N |  |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | Status | tinyint | N | ((1)) |  |
| 22 | BasePosInvoiceID | int | Y |  |  |
| 23 | UniqueId | bigint | N | ((0)) |  |
| 24 | SaleAgentID | int | Y |  |  |
| 25 | RoundPrice | decimal(30,4) | N |  |  |
| 26 | TotalNetPriceBeforeRound | decimal(30,4) | N |  |  |
| 27 | TemporaryNumber | int | Y |  |  |
| 28 | PricingCalculationID | int | Y |  |  |
| 29 | Deliverd | bit | N | ((0)) |  |

- **Primary key:** PosInvoiceID
- **index** `IX_POSINVOICE_FINANCE` (FinancialPeriodID)
- **FK** `FK_PosInvoice_PricingCalculation` (PricingCalculationID) -> SLE.PricingCalculation (PricingCalculationID)
- **FK** `FK_PosInvoice_SaleAgent` (SaleAgentID) -> SLE.SaleAgent (SaleAgentID)
- **FK** `FK_PosInvoice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PosInvoice_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PosInvoice_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PosInvoice_Party` (CustomerID) -> CFG.Party (PartyID)
- **FK** `FK_PosInvoice_ReturnPosInvoice` (BasePosInvoiceID) -> POS.PosInvoice (PosInvoiceID)
- **FK** `FK_PosInvoice_StationShift` (StateShiftID) -> POS.StationShift (StationShiftID)
- **FK** `FK_PosInvoice_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** POS.DeliveryPosInvoice (PosInvoiceID); POS.InstallmentAccumulationItem (PosInvoiceId); POS.PosInvoice (BasePosInvoiceID); POS.PosInvoiceItem (PosInvoiceID); POS.PosReceipt (PosInvoiceID)

### POS.PosInvoiceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PosInvoiceItemID | int | N |  | identity |
| 2 | PosInvoiceID | int | N |  |  |
| 3 | SaleModelID | smallint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Fee | decimal(30,10) | N |  |  |
| 8 | Price | decimal(30,4) | N |  |  |
| 9 | Discount | decimal(30,4) | N |  |  |
| 10 | Tax | decimal(30,4) | N |  |  |
| 11 | Duty | decimal(30,4) | N |  |  |
| 12 | NetPrice | decimal(30,4) | N |  |  |
| 13 | Cost | decimal(30,4) | N | ((0)) |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | ParentPosInvoiceItemID | int | Y |  |  |
| 20 | RowIndex | smallint | Y |  |  |
| 21 | OrderFoodItemID | int | Y |  |  |
| 22 | PricedFromBase | bit | N | ((0)) |  |

- **Primary key:** PosInvoiceItemID
- **index** `IX_PosInvoiceItem_PosInvoiceId` (PosInvoiceID) include (Price, Discount, Tax, Duty, NetPrice)
- **index** `IX_POSINVOICEITEM_StuffID` (StuffID)
- **FK** `FK_PosInvoiceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PosInvoiceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PosInvoiceItem_OrderFoodItem` (OrderFoodItemID) -> POS.OrderFoodItem (OrderFoodItemID)
- **FK** `FK_PosInvoiceItem_PosInvoice` (PosInvoiceID) -> POS.PosInvoice (PosInvoiceID) on delete CASCADE
- **FK** `FK_PosInvoiceItem_PosInvoiceItem` (ParentPosInvoiceItemID) -> POS.PosInvoiceItem (PosInvoiceItemID)
- **FK** `FK_PosInvoiceItem_SaleModel` (SaleModelID) -> SLE.SaleModel (SaleModelID)
- **FK** `FK_PosInvoiceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** POS.PosInvoiceItem (ParentPosInvoiceItemID); POS.PosInvoiceItemTrace (PosInvoiceItemID); SLE.PricingCalculationItemParameterValue (PosInvoiceItemID); STC.RevisionCostItem (PosInvoiceItemID); STC.RevisionCostItem (PosReturnInvoiceItemID)

### POS.PosInvoiceItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PosInvoiceItemTraceID | int | N |  | identity |
| 2 | PosInvoiceItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** PosInvoiceItemTraceID
- **FK** `FK_PosInvoiceItemTrace_PosInvoiceItem` (PosInvoiceItemID) -> POS.PosInvoiceItem (PosInvoiceItemID) on delete CASCADE
- **FK** `FK_PosInvoiceItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_PosInvoiceItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PosInvoiceItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PosInvoiceItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)

### POS.PosReceipt

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PosReceiptID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | PosInvoiceID | int | Y |  |  |
| 4 | IsPayed | bit | N | ((0)) |  |
| 5 | StationShiftID | int | N |  |  |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | Description | nvarchar(2048) | N |  |  |
| 9 | CustomerID | bigint | N |  |  |
| 10 | TotalAmount | decimal(18,4) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Discount | decimal(30,4) | N | ((0)) |  |

- **Primary key:** PosReceiptID
- **index** `IX_PosInvoice` (PosInvoiceID)
- **FK** `FK_PosReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PosReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PosReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PosReceipt_Party` (CustomerID) -> CFG.Party (PartyID)
- **FK** `FK_PosReceipt_PosInvoice` (PosInvoiceID) -> POS.PosInvoice (PosInvoiceID)
- **FK** `FK_PosReceipt_StationShift` (StationShiftID) -> POS.StationShift (StationShiftID)
- **Referenced by:** POS.PosReceiptItem (PosReceiptID)

### POS.PosReceiptItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PosReceiptItemID | int | N |  | identity |
| 2 | PosReceiptID | int | N |  |  |
| 3 | ItemType | tinyint | N |  |  |
| 4 | CardReaderID | int | Y |  |  |
| 5 | TracingNumber | varchar(50) | Y |  |  |
| 6 | CashID | int | Y |  |  |
| 7 | Amount | decimal(18,4) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | ShoppingCartID | int | Y |  |  |
| 14 | SubscribeCardChargeID | int | Y |  |  |
| 15 | PartyID | bigint | Y |  |  |
| 16 | CurrencyID | int | N | ((-1)) |  |
| 17 | CurrencyRate | decimal(36,10) | N |  |  |
| 18 | IsPayed | bit | N | ((0)) |  |
| 19 | Date | date | Y |  |  |
| 20 | BankID | int | Y |  |  |
| 21 | AccountNumber | varchar(50) | Y |  |  |
| 22 | BankAccountID | int | Y |  |  |

- **Primary key:** PosReceiptItemID
- **index** `IX_PosReceiptAmount` (PosReceiptID) include (Amount)
- **index** `IX_PosReceiptID_Items` (PosReceiptID) include (CardReaderID, CashID, ShoppingCartID, SubscribeCardChargeID)
- **FK** `FK_PosReceiptItem_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_PosReceiptItem_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PosReceiptItem_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PosReceipt_ShoppingCart` (ShoppingCartID) -> CTM.ShoppingCart (ShoppingCartID)
- **FK** `FK_PosReceipt_SubscribeCardCharge` (SubscribeCardChargeID) -> CTM.SubscribeCardCharge (SubscribeCardChargeID)
- **FK** `FK_PosReceiptItem_CardReader` (CardReaderID) -> POS.CardReader (CardReaderID)
- **FK** `FK_PosReceiptItem_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_PosReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PosReceiptItem_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PosReceiptItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PosReceiptItem_PosReceipt` (PosReceiptID) -> POS.PosReceipt (PosReceiptID) on delete CASCADE
- **Referenced by:** POS.CardReaderSettlementItem (PosReceiptItemID); POS.DeliverChequeItem (PosReceiptItemID); POS.DeliveryPosReceiptItem (PosReceiptItemID)

### POS.RestaurantTable

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RestaurantTableID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | Title | nvarchar(255) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RestaurantTableID
- **FK** `FK_RestaurantTable_Station` (StationID) -> POS.Station (StationID)
- **FK** `FK_RestaurantTable_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RestaurantTable_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** POS.OrderFood (RestaurantTableID)

### POS.Station

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Code | nvarchar(256) | N |  |  |
| 5 | BranchID | int | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | StationType | tinyint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | PrintServiceServerUrl | nvarchar(256) | Y |  |  |
| 14 | DlID | bigint | N |  |  |
| 15 | HasSpecialStuff | bit | N | ((0)) |  |
| 16 | HasReceiveCurrency | bit | N | ((0)) |  |
| 17 | CanReceiveMoreCash | bit | N |  |  |
| 18 | HasRound | bit | N |  |  |
| 19 | RoundType | tinyint | Y |  |  |
| 20 | RoundCount | tinyint | Y |  |  |
| 21 | CardReaderServicePath | nvarchar(250) | Y |  |  |
| 22 | Type | tinyint | N | ((1)) |  |
| 23 | UserID | int | Y |  |  |
| 24 | CostCenterDlID | bigint | Y |  |  |
| 25 | StockID | int | Y |  |  |
| 26 | SettelmentDefaultStatus | tinyint | N | ((3)) |  |
| 27 | PaymentTypeID | int | Y |  |  |
| 28 | ReceiptTypeID | int | Y |  |  |
| 29 | ExemptFromVat | bit | N |  |  |

- **Primary key:** StationID
- **FK** `FK_Station_CostCenterDl` (CostCenterDlID) -> ACC.DL (DLID)
- **FK** `FK_Station_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_Station_PaymentType` (PaymentTypeID) -> FIN.PaymentType (PaymentTypeID)
- **FK** `FK_Station_ReceiptType` (ReceiptTypeID) -> FIN.ReceiptType (ReceiptTypeID)
- **FK** `FK_Station_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_Station_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Station_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Station_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Station_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** CFG.NumberingPatternItem (StationId); POS.RestaurantTable (StationID); POS.StationCardReader (StationID); POS.StationCash (StationID); POS.StationPrintSetting (StationID); POS.StationSaleAgent (StationID); POS.StationSaleModel (StationID); POS.StationShift (StationID); POS.StationVitrin (StationID); POS.Subscription (StationID)

### POS.StationCardReader

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationCardReaderID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | CardReaderID | int | N |  |  |
| 4 | IsDefault | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StationCardReaderID
- **FK** `FK_StationCardReader_CardReader` (CardReaderID) -> POS.CardReader (CardReaderID)
- **FK** `FK_StationCardReader_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationCardReader_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationCardReader_Station` (StationID) -> POS.Station (StationID) on delete CASCADE

### POS.StationCash

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationCashID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | CashID | int | N |  |  |
| 4 | IsDefault | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StationCashID
- **FK** `FK_StationCash_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_StationCash_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationCash_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationCash_Station` (StationID) -> POS.Station (StationID) on delete CASCADE

### POS.StationFixService

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationFixServiceID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | ServiceID | int | N |  |  |
| 4 | ServiceTypeID | tinyint | N |  |  |
| 5 | ValuePercent | decimal(4,2) | N |  |  |
| 6 | Price | decimal(30,4) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** StationFixServiceID
- **FK** `FK_StationFixService_Stuff` (ServiceID) -> STF.Stuff (StuffID)
- **FK** `FK_StationFixService_UserCreator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationFixService_LastEditorUser` (LastEditor) -> CFG.User (UserID)

### POS.StationPrintGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPrintGroupID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Code | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StationPrintGroupID
- **FK** `FK_StationPrintGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPrintGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** POS.StationPrintGroupStuff (StationPrintGroupID); POS.StationPrintSetting (StationPrintGroupID)

### POS.StationPrintGroupStuff

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPrintGroupStuffID | int | N |  | identity |
| 2 | StationPrintGroupID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** StationPrintGroupStuffID
- **FK** `FK_StationPrintGroupStuff_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE
- **FK** `FK_StationPrintGroupStuff_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPrintGroupStuff_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationPrintGroupStuff_StationPrintGroup` (StationPrintGroupID) -> POS.StationPrintGroup (StationPrintGroupID) on delete CASCADE

### POS.StationPrintSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPrintSettingID | int | N |  | identity |
| 2 | StationPrintGroupID | int | Y |  |  |
| 3 | StationID | int | N |  |  |
| 4 | ReportID | int | Y |  |  |
| 5 | PrintType | tinyint | Y |  |  |
| 6 | PrinterName | varchar(256) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** StationPrintSettingID
- **FK** `FK_StationPrintSetting_Station` (StationID) -> POS.Station (StationID)
- **FK** `FK_StationPrintSetting_PrintGroup` (StationPrintGroupID) -> POS.StationPrintGroup (StationPrintGroupID)
- **FK** `FK_StationPrintSetting_Report` (ReportID) -> CFG.SaturnReport (ReportID)
- **FK** `FK_StationPrintSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPrintSetting_LastEditor` (LastEditor) -> CFG.User (UserID)

### POS.StationSaleAgent

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationSaleAgentID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | SaleAgentID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** StationSaleAgentID
- **FK** `FK_StationSaleAgent_Station` (StationID) -> POS.Station (StationID) on delete CASCADE
- **FK** `FK_StationSaleAgent_SaleAgent` (SaleAgentID) -> SLE.SaleAgent (SaleAgentID)
- **FK** `FK_StationSaleAgent_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationSaleAgent_EditorUser` (LastEditor) -> CFG.User (UserID)

### POS.StationSaleModel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationSaleModelID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | SaleModelID | smallint | N |  |  |
| 4 | IsDefault | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | ShowHasPriceList | bit | N | ((0)) |  |

- **Primary key:** StationSaleModelID
- **FK** `FK_StationSaleModel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationSaleModel_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationSaleModel_SaleModel` (SaleModelID) -> SLE.SaleModel (SaleModelID)
- **FK** `FK_StationSaleModel_Station` (StationID) -> POS.Station (StationID) on delete CASCADE

### POS.StationShift

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationShiftID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Code | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | ActivityTimeID | int | N |  |  |

- **Primary key:** StationShiftID
- **FK** `FK_StationShift_Station` (StationID) -> POS.Station (StationID)
- **FK** `FK_StationShift_ActivityTime` (ActivityTimeID) -> POS.ActivityTime (ActivityTimeID)
- **Referenced by:** POS.DeliverCheque (StationShiftID); POS.Delivery (StationShiftID); POS.OrderFood (StationShiftID); POS.PosInvoice (StateShiftID); POS.PosReceipt (StationShiftID); SLE.PricingCalculation (StationShiftID)

### POS.StationVitrin

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationVitrinID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | Title | nvarchar(128) | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | ViewOrder | tinyint | N | ((1)) |  |

- **Primary key:** StationVitrinID
- **FK** `FK_StationVitrin_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationVitrin_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationVitrin_Station` (StationID) -> POS.Station (StationID)
- **Referenced by:** POS.StationVitrinItem (StationVitrinID)

### POS.StationVitrinItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationVitrinItemID | int | N |  | identity |
| 2 | StationVitrinID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | Title | nvarchar(256) | Y |  |  |
| 6 | SameAsStuffTitle | bit | N |  |  |
| 7 | ItemIndex | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** StationVitrinItemID
- **FK** `FK_StationVitrinItem_StationVitrin` (StationVitrinID) -> POS.StationVitrin (StationVitrinID) on delete CASCADE
- **FK** `FK_StationVitrinItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationVitrinItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationVitrinItem_Stuff` (StuffID) -> STF.Stuff (StuffID)

### POS.Subscription

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SubscriptionID | int | N |  | identity |
| 2 | StationID | int | N |  |  |
| 3 | Title | nvarchar(255) | N |  |  |
| 4 | Address | nvarchar(MAX) | N |  |  |
| 5 | Phone | nvarchar(20) | Y |  |  |
| 6 | Mobile | nvarchar(20) | Y |  |  |
| 7 | Number | int | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SubscriptionID
- **FK** `FK_Subscription_Station` (StationID) -> POS.Station (StationID)
- **FK** `FK_Subscription_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Subscription_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** POS.OrderFood (SubscriptionID)

## Views

### POS.PosInvoiceView

Definition: `programmability/views/POS.PosInvoiceView.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PosInvoiceID | int | N |
| 2 | FinancialPeriodID | int | N |
| 3 | Number | int | N |
| 4 | IsReturnInvoice | bit | N |
| 5 | Date | date | N |
| 6 | StateShiftID | int | N |
| 7 | StockID | int | Y |
| 8 | CustomerID | bigint | N |
| 9 | TotalPrice | decimal(30,4) | N |
| 10 | TotalDiscount | decimal(30,4) | N |
| 11 | TotalNetPrice | decimal(30,4) | N |
| 12 | TotalTax | decimal(30,4) | N |
| 13 | TotalDuty | decimal(30,4) | N |
| 14 | HasInstallment | bit | N |
| 15 | HasCredit | bit | N |
| 16 | Version | int | N |
| 17 | Creator | int | N |
| 18 | CreationDate | datetime | N |
| 19 | LastEditor | int | N |
| 20 | LastEditionDate | datetime | N |
| 21 | STATUS | tinyint | N |
| 22 | StationID | int | N |

### POS.PosReturnInvoice

Definition: `programmability/views/POS.PosReturnInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PosInvoiceID | int | N |
| 2 | FinancialPeriodID | int | N |
| 3 | Number | int | N |
| 4 | IsReturnInvoice | bit | N |
| 5 | Date | date | N |
| 6 | StateShiftID | int | N |
| 7 | StockID | int | Y |
| 8 | CustomerID | bigint | N |
| 9 | TotalPrice | decimal(30,4) | N |
| 10 | TotalDiscount | decimal(30,4) | N |
| 11 | TotalNetPrice | decimal(30,4) | N |
| 12 | TotalTax | decimal(30,4) | N |
| 13 | TotalDuty | decimal(30,4) | N |
| 14 | HasInstallment | bit | N |
| 15 | HasCredit | bit | N |
| 16 | Version | int | N |
| 17 | Creator | int | N |
| 18 | CreationDate | datetime | N |
| 19 | LastEditor | int | N |
| 20 | LastEditionDate | datetime | N |
| 21 | STATUS | tinyint | N |
| 22 | StationID | int | N |

### POS.vwShiftSatationShift

Definition: `programmability/views/POS.vwShiftSatationShift.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StationID | int | N |
| 2 | StationTitle | nvarchar(256) | N |
| 3 | ShiftTitle | nvarchar(256) | N |
| 4 | FullCode | nvarchar(101) | Y |
| 5 | StationShiftID | int | N |

