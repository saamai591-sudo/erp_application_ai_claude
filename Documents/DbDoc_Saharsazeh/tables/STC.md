# Schema `STC`

## Tables

### STC.ConvertSpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConvertSpecificationID | int | N |  | identity |
| 2 | OutgoingItemID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(36,10) | Y |  |  |
| 5 | SubQuantity | decimal(36,10) | Y |  |  |
| 6 | Rate | decimal(13,10) | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |

- **Primary key:** ConvertSpecificationID
- **FK** `FK_ConvertSpecification_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConvertSpecification_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConvertSpecification_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_ConvertSpecification_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** STC.ConvertSpecificationTrace (ConvertSpecificationID); STC.StockReceiptItem (ConvertSpecificationID)

### STC.ConvertSpecificationTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConvertSpecificationTraceID | int | N |  | identity |
| 2 | ConvertSpecificationID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ConvertSpecificationTraceID
- **FK** `FK_ConvertSpecificationTrace_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConvertSpecificationTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ConvertSpecificationTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_ConvertSpecificationTrace_ConvertSpecification` (ConvertSpecificationID) -> STC.ConvertSpecification (ConvertSpecificationID) on delete CASCADE
- **FK** `FK_ConvertSpecificationTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConvertSpecificationTrace_DL` (DlID) -> ACC.DL (DLID)

### STC.InventoryEdition

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InventoryEditionID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StockID | int | N |  |  |
| 6 | Description2 | nvarchar(256) | Y |  |  |
| 7 | Description | nvarchar(256) | Y |  |  |
| 8 | StockReceiptID | int | Y |  |  |
| 9 | OutgoingID | int | Y |  |  |
| 10 | Status | tinyint | N | ((0)) |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** InventoryEditionID
- **FK** `FK_InventoryEdition_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InventoryEdition_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_InventoryEdition_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InventoryEdition_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete SET_NULL
- **FK** `FK_InventoryEdition_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_InventoryEdition_StockReceipt` (StockReceiptID) -> STC.StockReceipt (StockReceiptID) on delete SET_NULL
- **Referenced by:** STC.InventoryEditionItem (InventoryEditionID)

### STC.InventoryEditionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InventoryEditionItemID | int | N |  | identity |
| 2 | InventoryEditionID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | SubQuantity | decimal(36,10) | Y |  |  |
| 7 | Description2 | nvarchar(256) | Y |  |  |
| 8 | Description | nvarchar(256) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** InventoryEditionItemID
- **FK** `FK_InventoryEditionItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_InventoryEditionItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InventoryEditionItem_InventoryEdition` (InventoryEditionID) -> STC.InventoryEdition (InventoryEditionID) on delete CASCADE
- **FK** `FK_InventoryEditionItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.InventoryEditionItemTrace (InventoryEditionItemID)

### STC.InventoryEditionItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InventoryEditionItemTraceID | int | N |  | identity |
| 2 | InventoryEditionItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** InventoryEditionItemTraceID
- **FK** `FK_InventoryEditionItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InventoryEditionItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_InventoryEditionItemTrace_InventoryEditionItem` (InventoryEditionItemID) -> STC.InventoryEditionItem (InventoryEditionItemID) on delete CASCADE
- **FK** `FK_InventoryEditionItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InventoryEditionItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_InventoryEditionItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### STC.InventoryMethod

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InventoryMethodID | int | N |  | identity |
| 2 | Title | nvarchar(150) | N |  |  |
| 3 | Title2 | nvarchar(150) | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | CountingTurns | tinyint | N |  |  |
| 6 | MinQuantity | decimal(18,4) | N |  |  |
| 7 | SecondRecountableType | tinyint | Y |  |  |
| 8 | SecondRecountableConflict | int | Y |  |  |
| 9 | ThirdRecountableType | tinyint | Y |  |  |
| 10 | ThirdRecountableConflict | int | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | Number | int | N |  |  |

- **Primary key:** InventoryMethodID
- **FK** `FK_InventoryMethod_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InventoryMethod_UserEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.InventoryMethodStock (InventoryMethodID); STC.RecountingInventoryPeriod (InventoryMethodID)

### STC.InventoryMethodStock

Rows: 11

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InventoryMethodStockID | int | N |  | identity |
| 2 | InventoryMethodID | int | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | RowIndex | int | N |  |  |

- **Primary key:** InventoryMethodStockID
- **FK** `FK_InventoryMethodStock_Editor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InventoryMethodStock_InventoryMethod` (InventoryMethodID) -> STC.InventoryMethod (InventoryMethodID) on delete CASCADE
- **FK** `FK_InventoryMethodStock_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_InventoryMethodStock_User` (Creator) -> CFG.User (UserID)

### STC.JustificationInput

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JustificationInputID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | StockID | int | N |  |  |
| 5 | DeliverDlID | bigint | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | FinancialPeriodID | int | N |  |  |
| 12 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** JustificationInputID
- **FK** `FK_JustificationInput_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_JustificationInput_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_JustificationInput_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_JustificationInput_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_JustificationInput_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.JustificationInputItem (JustificationInputID)

### STC.JustificationInputItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JustificationInputItemID | int | N |  | identity |
| 2 | JustificationInputID | int | N |  |  |
| 3 | PurchaseRequestItemID | int | Y |  |  |
| 4 | ProposalItemID | int | Y |  |  |
| 5 | TemporaryStockReceiptItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | Y |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Description | nvarchar(256) | Y |  |  |
| 10 | Description2 | nvarchar(256) | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | RowIndex | int | N |  |  |
| 17 | PurchaseContractItemID | int | Y |  |  |

- **Primary key:** JustificationInputItemID
- **FK** `FK_JustificationInputItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_JustificationInputItem_JustificationInput` (JustificationInputID) -> STC.JustificationInput (JustificationInputID) on delete CASCADE
- **FK** `FK_JustificationInputItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_JustificationInputItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_JustificationInputItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_JustificationInputItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_JustificationInputItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_JustificationInputItem_TemporaryStockReceiptItem` (TemporaryStockReceiptItemID) -> STC.TemporaryStockReceiptItem (TemporaryStockReceiptItemID)
- **Referenced by:** STC.JustificationInputItemTrace (JustificationInputItemID); STC.StockReceiptItem (JustificationInputItemID)

### STC.JustificationInputItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JustificationInputItemTraceID | int | N |  | identity |
| 2 | JustificationInputItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** JustificationInputItemTraceID
- **FK** `FK_JustificationInputItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_JustificationInputItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_JustificationInputItemTrace_JustificationInputItem` (JustificationInputItemID) -> STC.JustificationInputItem (JustificationInputItemID) on delete CASCADE
- **FK** `FK_JustificationInputItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_JustificationInputItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_JustificationInputItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### STC.Outgoing

Rows: 9427

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingID | int | N |  | identity |
| 2 | AutoGenerated | bit | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StockID | int | N |  |  |
| 6 | DeliverDlID | bigint | Y |  |  |
| 7 | DeliverStockID | int | Y |  |  |
| 8 | TotalPrice | decimal(36,10) | Y |  |  |
| 9 | FinancialPeriodID | int | N |  |  |
| 10 | PreVoucherID | int | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** OutgoingID
- **index** `IX_OUTGOING_FINANCE` (FinancialPeriodID)
- **FK** `FK_Outgoing_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_Outgoing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Outgoing_DeliverDl` (DeliverDlID) -> ACC.DL (DLID)
- **FK** `FK_Outgoing_DeliverStock` (DeliverStockID) -> STF.Stock (StockID)
- **FK** `FK_Outgoing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Outgoing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Outgoing_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Outgoing_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** POS.Delivery (OutgoingID); PRM.ProductionStatistic (OutgoingID); PRM.StandardConsumption (OutgoingID); STC.InventoryEdition (OutgoingID); STC.OutgoingDl (OutgoingID); STC.OutgoingItem (OutgoingID); STC.RecountingInventory (OutgoingID); STC.StockReceipt (OutgoingID)

### STC.OutgoingAccSetting

Rows: 16

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingAccSettingID | int | N |  | identity |
| 2 | OutgoingItemID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | IsDebit | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** OutgoingAccSettingID
- **FK** `FK_OutgoingAccSetting_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingAccSetting_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OutgoingAccSetting_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID) on delete CASCADE
- **Referenced by:** STC.OutgoingAccSettingAccountLevel (OutgoingAccSettingID)

### STC.OutgoingAccSettingAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingAccSettingAccountLevelID | int | N |  | identity |
| 2 | OutgoingAccSettingID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** OutgoingAccSettingAccountLevelID
- **FK** `FK_OutgoingAccSettingAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_OutgoingAccSettingAccountLevel_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingAccSettingAccountLevel_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OutgoingAccSettingAccountLevel_OutgoingAccSetting` (OutgoingAccSettingID) -> STC.OutgoingAccSetting (OutgoingAccSettingID) on delete CASCADE
- **FK** `FK_OutgoingAccSettingAccountLevel_DL` (DlID) -> ACC.DL (DLID)

### STC.OutgoingDl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingDlID | int | N |  | identity |
| 2 | OutgoingID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** OutgoingDlID
- **FK** `FK_OutgoingDl_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingDl_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_OutgoingDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_OutgoingDl_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OutgoingDl_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete CASCADE

### STC.OutgoingItem

Rows: 57417

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingItemID | int | N |  | identity |
| 2 | OutgoingID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | JustificationItemID | int | Y |  |  |
| 5 | QuotationItemID | int | Y |  |  |
| 6 | InvoiceItemID | int | Y |  |  |
| 7 | RemittanceItemID | int | Y |  |  |
| 8 | StuffRequestItemID | int | Y |  |  |
| 9 | TemporaryOutgoingItemID | int | Y |  |  |
| 10 | ReceptionID | int | Y |  |  |
| 11 | StuffID | int | N |  |  |
| 12 | MainQuantity | decimal(36,10) | Y |  |  |
| 13 | SubQuantity | decimal(36,10) | Y |  |  |
| 14 | Fee | decimal(36,10) | Y |  |  |
| 15 | Price | decimal(36,10) | Y |  |  |
| 16 | Description | nvarchar(250) | Y |  |  |
| 17 | Description2 | nvarchar(250) | Y |  |  |
| 18 | Version | int | N |  |  |
| 19 | Creator | int | N |  |  |
| 20 | CreationDate | datetime | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | SaleContractItemID | int | Y |  |  |
| 24 | StuffCompositionID | int | Y |  |  |
| 25 | ZoneID | int | Y |  |  |
| 26 | IsQuantityIncreasable | bit | N | ((0)) |  |

- **Primary key:** OutgoingItemID
- **index** `IX_OutgoingItem_InvoiceItemID_MainQuantity_SubQuantity` (InvoiceItemID) include (MainQuantity, SubQuantity)
- **index** `NonClusteredIndex-OutgoingID` (OutgoingID) include (MainQuantity, StuffID, SubQuantity)
- **index** `IX_OutgoingItem_QuotationItemID_MainQuantity_SubQuantity` (QuotationItemID) include (MainQuantity, SubQuantity)
- **index** `IX_OutgoingItem_RemittanceItemID_MainQuantity_SubQuantity` (RemittanceItemID) include (MainQuantity, SubQuantity)
- **FK** `FK_OutgoingItem_StuffComposition` (StuffCompositionID) -> STC.StuffComposition (StuffCompositionID)
- **FK** `FK_OutgoingItem_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete CASCADE
- **FK** `FK_OutgoingItem_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **FK** `FK_OutgoingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingItem_InvoiceItem` (InvoiceItemID) -> SLE.InvoiceItem (InvoiceItemID)
- **FK** `FK_OutgoingItem_JustificationItem` (JustificationItemID) -> SLE.JustificationItem (JustificationItemID)
- **FK** `FK_OutgoingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OutgoingItem_QuotationItem` (QuotationItemID) -> SLE.QuotationItem (QuotationItemID)
- **FK** `FK_OutgoingItem_Reception` (ReceptionID) -> CTM.Reception (ReceptionID)
- **FK** `FK_OutgoingItem_RemittanceItem` (RemittanceItemID) -> SLE.RemittanceItem (RemittanceItemID)
- **FK** `FK_OutgoingItem_SaleContractItem` (SaleContractItemID) -> SLE.SaleContractItem (SaleContractItemID)
- **FK** `FK_OutgoingItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_OutgoingItem_StuffRequestItem` (StuffRequestItemID) -> REQ.StuffRequestItem (StuffRequestItemID)
- **FK** `FK_OutgoingItem_TemporaryOutgoingItem` (TemporaryOutgoingItemID) -> STC.TemporaryOutgoingItem (TemporaryOutgoingItemID)
- **Referenced by:** AST.AssetReceiptItem (OutgoingItemID); AST.AssetReceiptUtilizationCost (OutgoingItemID); AST.Creation (OutgoingItemID); AST.RepairStuffCost (OutgoingItemID); AST.UtilizationCost (OutgoingItemID); SLE.InvoiceItem (OutgoingItemId); STC.ConvertSpecification (OutgoingItemID); STC.OutgoingAccSetting (OutgoingItemID); STC.OutgoingItemTrace (OutgoingItemID); STC.OutgoingSerialSpecification (OutgoingItemID); STC.ReturnedOutgoingItem (OutgoingItemID); STC.RevisionCostItem (OutgoingItemID); STC.StockReceiptChargingService (OutgoingItemID); STC.StockReceiptItem (OutgoingItemID); WMS.WarehouseOutput (OutgoingItemID)

### STC.OutgoingItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingItemTraceID | int | N |  | identity |
| 2 | OutgoingItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** OutgoingItemTraceID
- **unique index** `IX_OutgoingItemTrace` (OutgoingItemID, TraceID)
- **FK** `FK_OutgoingItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_OutgoingItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_OutgoingItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OutgoingItemTrace_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID) on delete CASCADE
- **FK** `FK_OutgoingItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.OutgoingSerialSpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OutgoingSerialSpecificationID | int | N |  | identity |
| 2 | OutgoingItemID | int | N |  |  |
| 3 | StuffSerialID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Step | int | N | ((-100)) |  |

- **Primary key:** OutgoingSerialSpecificationID
- **FK** `FK_OutgoingSerialSpecification_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID) on delete CASCADE
- **FK** `FK_OutgoingSerialSpecification_StuffSerial` (StuffSerialID) -> STF.StuffSerial (StuffSerialID)
- **FK** `FK_OutgoingSerialSpecification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OutgoingSerialSpecification_LastEditor` (LastEditor) -> CFG.User (UserID)

### STC.PricingItem

Rows: 9410

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PricingItemID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | StockID | int | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | version | int | N |  |  |
| 9 | LastPricingDate | date | N |  |  |

- **Primary key:** PricingItemID
- **index** `IX_PricingItem_StuffID` (StuffID)
- **index** `IX_PricingItem_StockID` (StockID)
- **FK** `FK_PricingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PricingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PricingItem_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_PricingItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** STC.PricingItemTrace (PricingItemID)

### STC.PricingItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PricingItemTraceId | int | N |  | identity |
| 2 | PricingItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | Value | nvarchar(MAX) | Y |  |  |
| 5 | DlID | bigint | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | version | int | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** PricingItemTraceId
- **unique index** `IX_PricingItemTrace` (PricingItemID, TraceID)
- **FK** `FK_PricingItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PricingItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PricingItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PricingItemTrace_PricingItem` (PricingItemID) -> STC.PricingItem (PricingItemID) on delete CASCADE
- **FK** `FK_PricingItemTrace_PricingItemTrace` (PricingItemTraceId) -> STC.PricingItemTrace (PricingItemTraceId)
- **FK** `FK_PricingItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_PricingItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **Referenced by:** STC.PricingItemTrace (PricingItemTraceId)

### STC.PricingStage

Rows: 25

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Stage | nvarchar(MAX) | Y |  |  |
| 2 | Date | date | Y |  |  |
| 3 | Time | time(7) | Y |  |  |


### STC.ProductionPrice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPriceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | FromDate | date | N |  |  |
| 4 | ToDate | date | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | DlID | bigint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ProductionPriceID
- **FK** `FK_ProductionPrice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPrice_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionPrice_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProductionPrice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.ProductionPriceItem (ProductionPriceID)

### STC.ProductionPriceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPriceItemID | int | N |  | identity |
| 2 | ProductionPriceID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Fee | decimal(36,10) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | RowIndex | smallint | N |  |  |

- **Primary key:** ProductionPriceItemID
- **FK** `FK_ProductionPriceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPriceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionPriceItem_ProductionPrice` (ProductionPriceID) -> STC.ProductionPrice (ProductionPriceID) on delete CASCADE
- **FK** `FK_ProductionPriceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** STC.ProductionPriceItemTrace (ProductionPriceItemID)

### STC.ProductionPriceItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPriceItemTraceID | int | N |  | identity |
| 2 | ProductionPriceItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionPriceItemTraceID
- **unique index** `IX_ProductionPriceItemTrace` (ProductionPriceItemID, TraceID)
- **FK** `FK_ProductionPriceItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_ProductionPriceItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPriceItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionPriceItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionPriceItemTrace_ProductionPriceItem` (ProductionPriceItemID) -> STC.ProductionPriceItem (ProductionPriceItemID) on delete CASCADE
- **FK** `FK_ProductionPriceItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.ReceiptCost

Rows: 423

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiptCostID | int | N |  | identity |
| 2 | StockReceiptID | int | N |  |  |
| 3 | PurchaseInvoiceItemID | int | Y |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | Price | decimal(36,10) | Y |  |  |
| 7 | ShareDividingBase | tinyint | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | ProformaDlId | bigint | Y |  |  |

- **Primary key:** ReceiptCostID
- **FK** `FK_ReceiptCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiptCost_Dl` (ProformaDlId) -> ACC.DL (DLID)
- **FK** `FK_ReceiptCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiptCost_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_ReceiptCost_StockReceipt` (StockReceiptID) -> STC.StockReceipt (StockReceiptID) on delete CASCADE
- **FK** `FK_ReceiptCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ReceiptCost_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)

### STC.RecountingInventory

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryID | int | N |  | identity |
| 2 | RecountingInventoryTagID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | StockReceiptID | int | Y |  |  |
| 9 | OutgoingID | int | Y |  |  |
| 10 | Status | tinyint | N |  |  |

- **Primary key:** RecountingInventoryID
- **FK** `FK_RecountingInventory_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventory_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecountingInventory_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete SET_NULL
- **FK** `FK_RecountingInventory_RecountingInventoryTag` (RecountingInventoryTagID) -> STC.RecountingInventoryTag (RecountingInventoryTagID)
- **FK** `FK_RecountingInventory_StockReceipt` (StockReceiptID) -> STC.StockReceipt (StockReceiptID) on delete SET_NULL
- **Referenced by:** STC.RecountingInventoryItem (RecountingInventoryID)

### STC.RecountingInventoryItem

Rows: 3466

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryItemID | int | N |  | identity |
| 2 | RecountingInventoryID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | MainQuantity | decimal(36,10) | Y |  |  |
| 5 | SubQuantity | decimal(36,10) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | RecountingInventoryTagItemID | int | N |  |  |
| 12 | ZoneID | int | Y |  |  |

- **Primary key:** RecountingInventoryItemID
- **FK** `FK_RecountingInventoryItem_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **FK** `FK_RecountingInventoryItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryItem_RecountingInventory` (RecountingInventoryID) -> STC.RecountingInventory (RecountingInventoryID) on delete CASCADE
- **FK** `FK_RecountingInventoryItem_RecountingInventoryTagItem` (RecountingInventoryTagItemID) -> STC.RecountingInventoryTagItem (RecountingInventoryTagItemID)

### STC.RecountingInventoryPeriod

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryPeriodID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | InventoryMethodID | int | N |  |  |
| 5 | FinancialPeriodID | int | N |  |  |
| 6 | StockID | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RecountingInventoryPeriodID
- **FK** `FK_RecountingInventoryPeriod_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_RecountingInventoryPeriod_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_RecountingInventoryPeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryPeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryPeriod_InventoryMethod` (InventoryMethodID) -> STC.InventoryMethod (InventoryMethodID)
- **Referenced by:** STC.RecountingInventoryTag (RecountingInventoryPeriodID)

### STC.RecountingInventoryTag

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryTagID | int | N |  | identity |
| 2 | Status | tinyint | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | RecountingInventoryPeriodID | int | N |  |  |

- **Primary key:** RecountingInventoryTagID
- **FK** `FK_RecountingInventoryTag_RecountingInventoryPeriod` (RecountingInventoryPeriodID) -> STC.RecountingInventoryPeriod (RecountingInventoryPeriodID)
- **FK** `FK_RecountingInventoryTag_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryTag_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.RecountingInventory (RecountingInventoryTagID); STC.RecountingInventoryTagItem (RecountingInventoryTagID)

### STC.RecountingInventoryTagItem

Rows: 2955

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryTagItemID | int | N |  | identity |
| 2 | RecountingInventoryTagID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | TagNumber | smallint | N |  |  |
| 10 | ZoneID | int | Y |  |  |

- **Primary key:** RecountingInventoryTagItemID
- **FK** `FK_RecountingInventoryTagItem_RecountingInventoryTag` (RecountingInventoryTagID) -> STC.RecountingInventoryTag (RecountingInventoryTagID) on delete CASCADE
- **FK** `FK_RecountingInventoryTagItem_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **FK** `FK_RecountingInventoryTagItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryTagItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryTagItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** STC.RecountingInventoryItem (RecountingInventoryTagItemID); STC.RecountingInventoryTagItemTrace (RecountingInventoryTagItemID)

### STC.RecountingInventoryTagItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecountingInventoryTagItemTraceID | int | N |  | identity |
| 2 | RecountingInventoryTagItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** RecountingInventoryTagItemTraceID
- **unique index** `IX_RecountingInventoryTagItemTrace` (RecountingInventoryTagItemID, TraceID)
- **FK** `FK_RecountingInventoryTagItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_RecountingInventoryTagItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryTagItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_RecountingInventoryTagItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecountingInventoryTagItemTrace_RecountingInventoryTagItem` (RecountingInventoryTagItemID) -> STC.RecountingInventoryTagItem (RecountingInventoryTagItemID) on delete CASCADE
- **FK** `FK_RecountingInventoryTagItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.ReturnedOutgoing

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedOutgoingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | DlDeliverID | bigint | Y |  |  |
| 5 | StockDeliverID | int | Y |  |  |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | ReturnStockReceiptID | int | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | TotalPrice | decimal(36,10) | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | AutoGenerated | bit | Y | ((0)) |  |
| 17 | StockDocumentTypeBaseEntityID | int | Y |  |  |

- **Primary key:** ReturnedOutgoingID
- **index** `IX_RET_OUTGOING_FINANCE` (FinancialPeriodID)
- **FK** `FK_ReturnedOutgoing_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_ReturnedOutgoing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoing_DlDeliver` (DlDeliverID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedOutgoing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnedOutgoing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoing_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ReturnedOutgoing_ReturnStockReceipt` (ReturnStockReceiptID) -> STC.ReturnStockReceipt (ReturnStockReceiptID)
- **FK** `FK_ReturnedOutgoing_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_ReturnedOutgoing_StockDeliver` (StockDeliverID) -> STF.Stock (StockID)
- **Referenced by:** POS.Delivery (ReturnedOutgoingID); STC.ReturnedOutgoingDl (ReturnedOutgoingID); STC.ReturnedOutgoingItem (ReturnedOutgoingID); STC.ReturnStockReceipt (ReturnedOutgoingID)

### STC.ReturnedOutgoingDl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedOutgoingDlID | int | N |  | identity |
| 2 | ReturnedOutgoingID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReturnedOutgoingDlID
- **FK** `FK_ReturnedOutgoingDl_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingDl_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedOutgoingDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_ReturnedOutgoingDl_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingDl_ReturnedOutgoing` (ReturnedOutgoingID) -> STC.ReturnedOutgoing (ReturnedOutgoingID) on delete CASCADE

### STC.ReturnedOutgoingItem

Rows: 327

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedOutgoingItemID | int | N |  | identity |
| 2 | ReturnedOutgoingID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | OutgoingItemID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(36,10) | Y |  |  |
| 7 | SubQuantity | decimal(36,10) | Y |  |  |
| 8 | Fee | decimal(36,10) | Y |  |  |
| 9 | Price | decimal(36,10) | Y |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | ReturnedSaleInvoiceItemID | int | Y |  |  |
| 18 | AutoPriced | bit | Y |  |  |
| 19 | ReturnedSaleJustificationItemID | int | Y |  |  |

- **Primary key:** ReturnedOutgoingItemID
- **FK** `FK_ReturnedOutgoingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingItem_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_ReturnedOutgoingItem_ReturnedOutgoing` (ReturnedOutgoingID) -> STC.ReturnedOutgoing (ReturnedOutgoingID) on delete CASCADE
- **FK** `FK_ReturnedOutgoingItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ReturnedOutgoingItem_ReturnedSaleInvoiceItem` (ReturnedSaleInvoiceItemID) -> SLE.ReturnedSaleInvoiceItem (ReturnedSaleInvoiceItemID)
- **FK** `FK_ReturnedOutgoingItem_ReturnedSaleJustificationItem` (ReturnedSaleJustificationItemID) -> SLE.ReturnedSaleJustificationItem (ReturnedSaleJustificationItemID)
- **FK** `FK_ReturnedOutgoingItem_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** SLE.ReturnedSaleInvoiceItem (ReturnedOutgoingItemID); STC.ReturnedOutgoingItemTrace (ReturnedOutgoingItemID); STC.ReturnedOutgoingSerialSpecification (ReturnedOutgoingItemID); STC.RevisionCostItem (ReturnedOutgoingItemID); WMS.PackingItem (ReturnedOutgoingItemID); WMS.PhysicalLocationItem (ReturnedOutgoingItemID)

### STC.ReturnedOutgoingItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedOutgoingItemTraceID | int | N |  | identity |
| 2 | ReturnedOutgoingItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReturnedOutgoingItemTraceID
- **index** `IX_ReturnedOutgoingItemTrace` (ReturnedOutgoingItemID, TraceID)
- **FK** `FK_ReturnedOutgoingItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedOutgoingItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingItemTrace_ReturnedOutgoingItem` (ReturnedOutgoingItemID) -> STC.ReturnedOutgoingItem (ReturnedOutgoingItemID) on delete CASCADE
- **FK** `FK_ReturnedOutgoingItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ReturnedOutgoingItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### STC.ReturnedOutgoingSerialSpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedOutgoingSerialSpecificationID | int | N |  | identity |
| 2 | ReturnedOutgoingItemID | int | N |  |  |
| 3 | StuffSerialID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Step | int | N | ((-100)) |  |

- **Primary key:** ReturnedOutgoingSerialSpecificationID
- **FK** `FK_ReturnedOutgoingSerialSpecification_ReturnedOutgoingItem` (ReturnedOutgoingItemID) -> STC.ReturnedOutgoingItem (ReturnedOutgoingItemID) on delete CASCADE
- **FK** `FK_ReturnedOutgoingSerialSpecification_StuffSerial` (StuffSerialID) -> STF.StuffSerial (StuffSerialID)
- **FK** `FK_ReturnedOutgoingSerialSpecification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedOutgoingSerialSpecification_LastEditor` (LastEditor) -> CFG.User (UserID)

### STC.ReturnedTemporaryOutgoing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedTemporaryOutgoingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StockID | int | N |  |  |
| 6 | DlID | bigint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReturnedTemporaryOutgoingID
- **FK** `FK_ReturnedTemporaryOutgoing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryOutgoing_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedTemporaryOutgoing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnedTemporaryOutgoing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryOutgoing_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.ReturnedTemporaryOutgoingItem (ReturnedTemporaryOutgoingID)

### STC.ReturnedTemporaryOutgoingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedTemporaryOutgoingItemID | int | N |  | identity |
| 2 | ReturnedTemporaryOutgoingID | int | N |  |  |
| 3 | TemporaryOutgoingItemID | int | N |  |  |
| 4 | MainQuantity | decimal(36,10) | Y |  |  |
| 5 | SubQuantity | decimal(36,10) | Y |  |  |
| 6 | Description | nvarchar(250) | Y |  |  |
| 7 | Description2 | nvarchar(250) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReturnedTemporaryOutgoingItemID
- **FK** `FK_ReturnedTemporaryOutgoingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryOutgoingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryOutgoingItem_ReturnedTemporaryOutgoing` (ReturnedTemporaryOutgoingID) -> STC.ReturnedTemporaryOutgoing (ReturnedTemporaryOutgoingID) on delete CASCADE
- **FK** `FK_ReturnedTemporaryOutgoingItem_TemporaryOutgoingItem` (TemporaryOutgoingItemID) -> STC.TemporaryOutgoingItem (TemporaryOutgoingItemID)

### STC.ReturnedTemporaryStockReceipt

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedTemporaryStockReceiptID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | StockID | int | N |  |  |
| 5 | DeliverDlID | bigint | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | FinancialPeriodID | int | N |  |  |
| 12 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** ReturnedTemporaryStockReceiptID
- **FK** `FK_ReturnedTemporaryStockReceipt_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_ReturnedTemporaryStockReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceipt_DL` (DeliverDlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedTemporaryStockReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnedTemporaryStockReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceipt_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.ReturnedTemporaryStockReceiptItem (ReturnedTemporaryStockReceiptID)

### STC.ReturnedTemporaryStockReceiptItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedTemporaryStockReceiptItemID | int | N |  | identity |
| 2 | ReturnedTemporaryStockReceiptID | int | N |  |  |
| 3 | TemporaryStockReceiptItemID | int | Y |  |  |
| 4 | ReturnRequestItemID | int | Y |  |  |
| 5 | RowIndex | int | N |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | Y |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Description | nvarchar(256) | Y |  |  |
| 10 | Description2 | nvarchar(256) | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |

- **Primary key:** ReturnedTemporaryStockReceiptItemID
- **FK** `FK_ReturnedTemporaryStockReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceiptItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceiptItem_ReturnedTemporaryStockReceipt` (ReturnedTemporaryStockReceiptID) -> STC.ReturnedTemporaryStockReceipt (ReturnedTemporaryStockReceiptID) on delete CASCADE
- **FK** `FK_ReturnedTemporaryStockReceiptItem_ReturnRequestItem` (ReturnRequestItemID) -> REQ.ReturnRequestItem (ReturnRequestItemID)
- **FK** `FK_ReturnedTemporaryStockReceiptItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ReturnedTemporaryStockReceiptItem_TemporaryStockReceiptItem` (TemporaryStockReceiptItemID) -> STC.TemporaryStockReceiptItem (TemporaryStockReceiptItemID)
- **Referenced by:** STC.ReturnedTemporaryStockReceiptItemTrace (ReturnedTemporaryStockReceiptItemID)

### STC.ReturnedTemporaryStockReceiptItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnedTemporaryStockReceiptItemTraceID | int | N |  | identity |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReturnedTemporaryStockReceiptItemTraceID
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_ReturnedTemporaryStockReceiptItem` (ReturnedTemporaryStockReceiptItemID) -> STC.ReturnedTemporaryStockReceiptItem (ReturnedTemporaryStockReceiptItemID) on delete CASCADE
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ReturnedTemporaryStockReceiptItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### STC.ReturnStockReceipt

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnStockReceiptID | int | N |  | identity |
| 2 | AutoGenerated | bit | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | DeliverDlID | bigint | Y |  |  |
| 5 | DeliverStockID | int | Y |  |  |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | TotalInvoicePrice | decimal(36,10) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | ReturnedOutgoingID | int | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | FinancialPeriodID | int | N |  |  |
| 17 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** ReturnStockReceiptID
- **index** `IX_ReturnSR_FINANCE` (FinancialPeriodID)
- **FK** `FK_ReturnStockReceipt_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_ReturnStockReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceipt_DeliverDL` (DeliverDlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnStockReceipt_DeliverStock` (DeliverStockID) -> STF.Stock (StockID)
- **FK** `FK_ReturnStockReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnStockReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceipt_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ReturnStockReceipt_ReturnedOutgoing` (ReturnedOutgoingID) -> STC.ReturnedOutgoing (ReturnedOutgoingID)
- **FK** `FK_ReturnStockReceipt_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.ReturnedOutgoing (ReturnStockReceiptID); STC.ReturnStockReceiptDl (ReturnStockReceiptID); STC.ReturnStockReceiptItem (ReturnStockReceiptID)

### STC.ReturnStockReceiptDl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnStockReceiptDlID | int | N |  | identity |
| 2 | ReturnStockReceiptID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReturnStockReceiptDlID
- **FK** `FK_ReturnStockReceiptDl_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptDl_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnStockReceiptDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_ReturnStockReceiptDl_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptDl_ReturnStockReceipt` (ReturnStockReceiptID) -> STC.ReturnStockReceipt (ReturnStockReceiptID) on delete CASCADE

### STC.ReturnStockReceiptItem

Rows: 4

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnStockReceiptItemID | int | N |  | identity |
| 2 | ReturnStockReceiptID | int | Y |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StockReceiptItemID | int | Y |  |  |
| 5 | ReturnRequestItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | Y |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Fee | decimal(36,10) | Y |  |  |
| 10 | Price | decimal(36,10) | Y |  |  |
| 11 | Description | nvarchar(256) | Y |  |  |
| 12 | Description2 | nvarchar(256) | Y |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | ZoneID | int | Y |  |  |

- **Primary key:** ReturnStockReceiptItemID
- **FK** `FK_ReturnStockReceiptItem_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **FK** `FK_ReturnStockReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptItem_ReturnRequestItem` (ReturnRequestItemID) -> REQ.ReturnRequestItem (ReturnRequestItemID)
- **FK** `FK_ReturnStockReceiptItem_ReturnStockReceipt` (ReturnStockReceiptID) -> STC.ReturnStockReceipt (ReturnStockReceiptID) on delete CASCADE
- **FK** `FK_ReturnStockReceiptItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_ReturnStockReceiptItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** STC.ReturnStockReceiptItemTrace (ReturnStockReceiptItemID); STC.ReturnStockReceiptSerialSpecification (ReturnStockReceiptItemID); STC.RevisionCostItem (ReturnStockReceiptItemID); VND.ReturnInvoiceItem (ReturnStockReceiptItemID); WMS.WarehouseOutput (ReturnStockReceiptItemID)

### STC.ReturnStockReceiptItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnStockReceiptItemTraceID | int | N |  | identity |
| 2 | ReturnStockReceiptItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReturnStockReceiptItemTraceID
- **unique index** `IX_ReturnStockReceiptItemTrace` (ReturnStockReceiptItemID, TraceID)
- **FK** `FK_ReturnStockReceiptItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_ReturnStockReceiptItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnStockReceiptItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptItemTrace_ReturnStockReceiptItem` (ReturnStockReceiptItemID) -> STC.ReturnStockReceiptItem (ReturnStockReceiptItemID) on delete CASCADE
- **FK** `FK_ReturnStockReceiptItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.ReturnStockReceiptSerialSpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnStockReceiptSerialSpecificationID | int | N |  | identity |
| 2 | ReturnStockReceiptItemID | int | N |  |  |
| 3 | StuffSerialID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Step | int | N | ((-100)) |  |

- **Primary key:** ReturnStockReceiptSerialSpecificationID
- **FK** `FK_ReturnStockReceiptSerialSpecification_ReturnStockReceiptItem` (ReturnStockReceiptItemID) -> STC.ReturnStockReceiptItem (ReturnStockReceiptItemID) on delete CASCADE
- **FK** `FK_ReturnStockReceiptSerialSpecification_StuffSerial` (StuffSerialID) -> STF.StuffSerial (StuffSerialID)
- **FK** `FK_ReturnStockReceiptSerialSpecification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnStockReceiptSerialSpecification_LastEditor` (LastEditor) -> CFG.User (UserID)

### STC.RevisionCost

Rows: 4

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RevisionCostID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | AutoGenerated | bit | N |  |  |
| 5 | PreVoucherID | int | Y |  |  |
| 6 | FinancialPeriodID | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Type | tinyint | N |  |  |
| 13 | BranchID | int | N | ((-1)) |  |
| 14 | AutoGenerateType | tinyint | Y |  |  |

- **Primary key:** RevisionCostID
- **FK** `FK_RevisionCost_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_RevisionCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RevisionCost_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_RevisionCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RevisionCost_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** STC.RevisionCostItem (RevisionCostID)

### STC.RevisionCostItem

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RevisionCostItemID | int | N |  | identity |
| 2 | RevisionCostID | int | N |  |  |
| 3 | StockReceiptItemID | int | Y |  |  |
| 4 | ReturnStockReceiptItemID | int | Y |  |  |
| 5 | ReturnedOutgoingItemID | int | Y |  |  |
| 6 | OutgoingItemID | int | Y |  |  |
| 7 | RevisionFee | decimal(36,10) | Y |  |  |
| 8 | RevisionPrice | decimal(36,10) | Y |  |  |
| 9 | Deference | decimal(36,10) | Y |  |  |
| 10 | Description | nvarchar(256) | Y |  |  |
| 11 | Description2 | nvarchar(256) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | PosInvoiceItemID | int | Y |  |  |
| 18 | PosReturnInvoiceItemID | int | Y |  |  |

- **Primary key:** RevisionCostItemID
- **FK** `RevisionCostItem_PosInvoiceItem` (PosInvoiceItemID) -> POS.PosInvoiceItem (PosInvoiceItemID)
- **FK** `RevisionCostItem_PosReturnInvoiceItem` (PosReturnInvoiceItemID) -> POS.PosInvoiceItem (PosInvoiceItemID)
- **FK** `FK_RevisionCostItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RevisionCostItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RevisionCostItem_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_RevisionCostItem_ReturnedOutgoingItem` (ReturnedOutgoingItemID) -> STC.ReturnedOutgoingItem (ReturnedOutgoingItemID)
- **FK** `FK_RevisionCostItem_ReturnStockReceiptItem` (ReturnStockReceiptItemID) -> STC.ReturnStockReceiptItem (ReturnStockReceiptItemID)
- **FK** `FK_RevisionCostItem_RevisionCost` (RevisionCostID) -> STC.RevisionCost (RevisionCostID) on delete CASCADE
- **FK** `FK_RevisionCostItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)

### STC.StockClosePeriod

Rows: 11

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockClosePeriodID | int | N |  | identity |
| 2 | StockID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockClosePeriodID
- **FK** `FK_StockClosePeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockClosePeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockClosePeriod_Stock` (StockID) -> STF.Stock (StockID)

### STC.StockClosingOperation

Rows: 43

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockClosingOperationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | Status | tinyint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockClosingOperationID
- **FK** `FK_StockClosingOperation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockClosingOperation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_StockClosingOperation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockClosingOperation_Stock` (StockID) -> STF.Stock (StockID)

### STC.StockDocumentType

Rows: 35

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockDocumentTypeID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | Code | tinyint | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | DocumentType | tinyint | N |  |  |
| 7 | DlTypeID | int | Y |  |  |
| 8 | SlBaseOnDl | bit | N |  |  |
| 9 | IsActive | bit | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | OpponentType | tinyint | N |  |  |

- **Primary key:** StockDocumentTypeID
- **FK** `FK_StockDocumentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockDocumentType_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_StockDocumentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.StockDocumentTypeBaseEntity (StockDocumentTypeID); STC.StockDocumentTypeDlType (StockDocumentTypeID); STF.StockDocumentTypeSlDl (StockDocumentTypeID)

### STC.StockDocumentTypeBaseEntity

Rows: 155

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockDocumentTypeBaseEntityID | int | N |  | identity |
| 2 | StockDocumentTypeID | int | N |  |  |
| 3 | Entity | tinyint | N |  |  |
| 4 | BaseEntity | tinyint | N |  |  |
| 5 | Code | int | N |  |  |
| 6 | IsActive | bit | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockDocumentTypeBaseEntityID
- **FK** `FK_StockDocumentTypeBaseEntity_StockDocumentType` (StockDocumentTypeID) -> STC.StockDocumentType (StockDocumentTypeID) on delete CASCADE
- **FK** `FK_StockDocumentTypeBaseEntity_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockDocumentTypeBaseEntity_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.JustificationInput (StockDocumentTypeBaseEntityID); STC.Outgoing (StockDocumentTypeBaseEntityID); STC.ReturnedOutgoing (StockDocumentTypeBaseEntityID); STC.ReturnedTemporaryStockReceipt (StockDocumentTypeBaseEntityID); STC.ReturnStockReceipt (StockDocumentTypeBaseEntityID); STC.StockReceipt (StockDocumentTypeBaseEntityID); STC.TemporaryStockReceipt (StockDocumentTypeBaseEntityID)

### STC.StockDocumentTypeDlType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockDocumentTypeDlTypeID | int | N |  | identity |
| 2 | StockDocumentTypeID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockDocumentTypeDlTypeID
- **FK** `FK_StockDocumentTypeDlType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockDocumentTypeDlType_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_StockDocumentTypeDlType_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockDocumentTypeDlType_StockDocumentType` (StockDocumentTypeID) -> STC.StockDocumentType (StockDocumentTypeID) on delete CASCADE

### STC.StockReceipt

Rows: 10669

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptID | int | N |  | identity |
| 2 | AutoGenerated | bit | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | DeliverDlID | bigint | Y |  |  |
| 5 | DeliverStockID | int | Y |  |  |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | TotalInvoicePrice | decimal(36,10) | N |  |  |
| 9 | TotalEstimatedPrice | decimal(36,10) | N |  |  |
| 10 | TotalCosts | decimal(36,10) | Y |  |  |
| 11 | TotalNetPrice | decimal(36,10) | N |  |  |
| 12 | PreVoucherID | int | Y |  |  |
| 13 | OutgoingID | int | Y |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | FinancialPeriodID | int | N |  |  |
| 20 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** StockReceiptID
- **index** `IX_STOCKRECIPT_FINANCE` (FinancialPeriodID)
- **FK** `FK_StockReceipt_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_StockReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceipt_DeliverDL` (DeliverDlID) -> ACC.DL (DLID)
- **FK** `FK_StockReceipt_DeliverStock` (DeliverStockID) -> STF.Stock (StockID)
- **FK** `FK_StockReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_StockReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockReceipt_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID)
- **FK** `FK_StockReceipt_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_StockReceipt_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.InventoryEdition (StockReceiptID); STC.ReceiptCost (StockReceiptID); STC.RecountingInventory (StockReceiptID); STC.StockReceiptDl (StockReceiptID); STC.StockReceiptItem (StockReceiptID)

### STC.StockReceiptChargingService

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptChargingServiceID | int | N |  | identity |
| 2 | RowIndex | int | N |  |  |
| 3 | StockReceiptItemID | int | N |  |  |
| 4 | OutgoingItemID | int | N |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | SubQuantity | decimal(36,10) | Y |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |

- **Primary key:** StockReceiptChargingServiceID
- **FK** `FK_StockReceiptChargingService_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_StockReceiptChargingService_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_StockReceiptChargingService_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceiptChargingService_EditorUser` (LastEditor) -> CFG.User (UserID)

### STC.StockReceiptDl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptDlID | int | N |  | identity |
| 2 | StockReceiptID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockReceiptDlID
- **FK** `FK_StockReceiptDl_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StockReceiptDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_StockReceiptDl_StockReceipt` (StockReceiptID) -> STC.StockReceipt (StockReceiptID) on delete CASCADE
- **FK** `FK_StockReceiptDl_User` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceiptDl_User1` (LastEditor) -> CFG.User (UserID)

### STC.StockReceiptItem

Rows: 49995

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptItemID | int | N |  | identity |
| 2 | StockReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | OutgoingItemID | int | Y |  |  |
| 5 | PurchaseInvoiceItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | N |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Fee | decimal(36,10) | N |  |  |
| 10 | Price | decimal(36,10) | N |  |  |
| 11 | EstimatedFee | decimal(36,10) | N |  |  |
| 12 | EstimatedPrice | decimal(36,10) | N |  |  |
| 13 | ShareOfCosts | decimal(36,10) | Y |  |  |
| 14 | Description | nvarchar(256) | Y |  |  |
| 15 | Description2 | nvarchar(256) | Y |  |  |
| 16 | Version | int | N |  |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | ProposalItemID | int | Y |  |  |
| 22 | PurchaseRequestItemID | int | Y |  |  |
| 23 | JustificationInputItemID | int | Y |  |  |
| 24 | PurchaseContractItemID | int | Y |  |  |
| 25 | ClearanceItemID | int | Y |  |  |
| 26 | ConvertSpecificationID | int | Y |  |  |
| 27 | ContractSubjectID | int | Y |  |  |
| 28 | ProductionPlanningItemID | int | Y |  |  |
| 29 | ProductionStatisticItemID | int | Y |  |  |
| 30 | DeliveryJustificationItemID | int | Y |  |  |
| 31 | NetPrice | decimal(37,10) | Y |  | computed: (round(case when [Price]<>(0) then [Price] else [EstimatedPrice] end+[ShareOfCosts],[CFG].[GetBaseCurrencyPrecision]())) |

- **Primary key:** StockReceiptItemID
- **index** `NonClusteredIndex-StockReceiptID` (StockReceiptID) include (StuffID, MainQuantity, SubQuantity)
- **FK** `FK_StockReceiptItem_DeliveryJustificationItem` (DeliveryJustificationItemID) -> VND.DeliveryJustificationItem (DeliveryJustificationItemID)
- **FK** `FK_StockReceiptItem_ClearanceItem` (ClearanceItemID) -> FOS.ClearanceItem (ClearanceItemID)
- **FK** `FK_StockReceiptItem_ProductionPlanningItem` (ProductionPlanningItemID) -> PRM.ProductionPlanningItem (ProductionPlanningItemID)
- **FK** `FK_StockReceiptItem_ContractSubject` (ContractSubjectID) -> CNT.ContractSubject (ContractSubjectID)
- **FK** `FK_StockReceiptItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **FK** `FK_StockReceiptItem_ConvertSpecification` (ConvertSpecificationID) -> STC.ConvertSpecification (ConvertSpecificationID)
- **FK** `FK_StockReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceiptItem_ProductionStatisticItem` (ProductionStatisticItemID) -> PRM.ProductionStatisticItem (ProductionStatisticItemID)
- **FK** `FK_StockReceiptItem_JustificationInputItem` (JustificationInputItemID) -> STC.JustificationInputItem (JustificationInputItemID)
- **FK** `FK_StockReceiptItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockReceiptItem_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_StockReceiptItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_StockReceiptItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_StockReceiptItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_StockReceiptItem_StockReceipt` (StockReceiptID) -> STC.StockReceipt (StockReceiptID) on delete CASCADE
- **FK** `FK_StockReceiptItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** REQ.ReturnRequestItem (StockReceiptItemID); STC.ReturnStockReceiptItem (StockReceiptItemID); STC.RevisionCostItem (StockReceiptItemID); STC.StockReceiptChargingService (StockReceiptItemID); STC.StockReceiptItemTrace (StockReceiptItemID); STC.StockReceiptSerialSpecification (StockReceiptItemID); STC.StuffComposition (StockReceiptItemID); VND.PurchaseInvoiceItem (StockReceiptItemID); WMS.PackingItem (StockReceiptItemID); WMS.PhysicalLocationItem (StockReceiptItemID)

### STC.StockReceiptItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptItemTraceID | int | N |  | identity |
| 2 | StockReceiptItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** StockReceiptItemTraceID
- **unique index** `IX_StockReceiptItemTrece` (StockReceiptItemID, TraceID)
- **FK** `FK_StockReceiptItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_StockReceiptItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceiptItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StockReceiptItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockReceiptItemTrace_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID) on delete CASCADE
- **FK** `FK_StockReceiptItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.StockReceiptSerialSpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockReceiptSerialSpecificationID | int | N |  | identity |
| 2 | StockReceiptItemID | int | N |  |  |
| 3 | StuffSerialID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Step | int | N | ((-100)) |  |

- **Primary key:** StockReceiptSerialSpecificationID
- **FK** `FK_StockReceiptSerialSpecification_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID) on delete CASCADE
- **FK** `FK_StockReceiptSerialSpecification_StuffSerial` (StuffSerialID) -> STF.StuffSerial (StuffSerialID)
- **FK** `FK_StockReceiptSerialSpecification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockReceiptSerialSpecification_LastEditor` (LastEditor) -> CFG.User (UserID)

### STC.StuffComposition

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffCompositionID | int | N |  | identity |
| 2 | StockReceiptItemID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(36,10) | Y |  |  |
| 5 | SubQuantity | decimal(36,10) | Y |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | ZoneID | int | Y |  |  |

- **Primary key:** StuffCompositionID
- **FK** `FK_StuffComposition_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_StuffComposition_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StuffComposition_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffComposition_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffComposition_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **Referenced by:** STC.OutgoingItem (StuffCompositionID); STC.StuffCompositionTrace (StuffCompositionID)

### STC.StuffCompositionTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffCompositionTraceID | int | N |  | identity |
| 2 | StuffCompositionID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** StuffCompositionTraceID
- **FK** `FK_StuffCompositionTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_StuffCompositionTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StuffCompositionTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffCompositionTrace_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffCompositionTrace_StuffComposition` (StuffCompositionID) -> STC.StuffComposition (StuffCompositionID) on delete CASCADE
- **FK** `FK_StuffCompositionTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### STC.TemporaryOutgoing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryOutgoingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StockID | int | N |  |  |
| 6 | DlID | bigint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TemporaryOutgoingID
- **FK** `FK_TemporaryOutgoing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoing_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TemporaryOutgoing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_TemporaryOutgoing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoing_Stock` (StockID) -> STF.Stock (StockID)
- **Referenced by:** STC.TemporaryOutgoingItem (TemporaryOutgoingID)

### STC.TemporaryOutgoingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryOutgoingItemID | int | N |  | identity |
| 2 | TemporaryOutgoingID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | ReceptionID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(36,10) | Y |  |  |
| 7 | SubQuantity | decimal(36,10) | Y |  |  |
| 8 | Description | nvarchar(250) | Y |  |  |
| 9 | Description2 | nvarchar(250) | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TemporaryOutgoingItemID
- **FK** `FK_TemporaryOutgoingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoingItem_Reception` (ReceptionID) -> CTM.Reception (ReceptionID)
- **FK** `FK_TemporaryOutgoingItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_TemporaryOutgoingItem_TemporaryOutgoing` (TemporaryOutgoingID) -> STC.TemporaryOutgoing (TemporaryOutgoingID) on delete CASCADE
- **Referenced by:** STC.OutgoingItem (TemporaryOutgoingItemID); STC.ReturnedTemporaryOutgoingItem (TemporaryOutgoingItemID); STC.TemporaryOutgoingItemTrace (TemporaryOutgoingItemID)

### STC.TemporaryOutgoingItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryOutgoingItemTraceID | int | N |  | identity |
| 2 | TemporaryOutgoingItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** TemporaryOutgoingItemTraceID
- **unique index** `IX_TemporaryOutgoingItemTrace` (TraceID, TemporaryOutgoingItemID)
- **FK** `FK_TemporaryOutgoingItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_TemporaryOutgoingItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoingItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TemporaryOutgoingItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryOutgoingItemTrace_TemporaryOutgoingItem` (TemporaryOutgoingItemID) -> STC.TemporaryOutgoingItem (TemporaryOutgoingItemID) on delete CASCADE
- **FK** `FK_TemporaryOutgoingItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### STC.TemporaryStockReceipt

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryStockReceiptID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | StockID | int | N |  |  |
| 5 | DeliverDlID | bigint | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | FinancialPeriodID | int | N |  |  |
| 12 | StockDocumentTypeBaseEntityID | int | N |  |  |

- **Primary key:** TemporaryStockReceiptID
- **FK** `FK_TemporaryStockReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceipt_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_TemporaryStockReceipt_StockDocumentTypeBaseEntity` (StockDocumentTypeBaseEntityID) -> STC.StockDocumentTypeBaseEntity (StockDocumentTypeBaseEntityID)
- **FK** `FK_TemporaryStockReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceipt_DL` (DeliverDlID) -> ACC.DL (DLID)
- **FK** `FK_TemporaryStockReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **Referenced by:** STC.TemporaryStockReceiptItem (TemporaryStockReceiptID)

### STC.TemporaryStockReceiptItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | N |  | identity |
| 2 | TemporaryStockReceiptID | int | N |  |  |
| 3 | PurchaseRequestItemID | int | Y |  |  |
| 4 | ProposalItemID | int | Y |  |  |
| 5 | RowIndex | int | N |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | Y |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Description | nvarchar(256) | Y |  |  |
| 10 | Description2 | nvarchar(256) | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | PurchaseContractItemID | int | Y |  |  |
| 17 | ContractSubjectID | int | Y |  |  |
| 18 | PurchaseInvoiceItemID | int | Y |  |  |
| 19 | DeliveryJustificationItemID | int | Y |  |  |

- **Primary key:** TemporaryStockReceiptItemID
- **FK** `FK_TemporaryStockReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceiptItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceiptItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_TemporaryStockReceiptItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_TemporaryStockReceiptItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_TemporaryStockReceiptItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_TemporaryStockReceiptItem_TemporaryStockReceipt` (TemporaryStockReceiptID) -> STC.TemporaryStockReceipt (TemporaryStockReceiptID) on delete CASCADE
- **FK** `FK_TemporaryStockReceiptItem_ContractSubject` (ContractSubjectID) -> CNT.ContractSubject (ContractSubjectID)
- **FK** `FK_TemporaryStockReceiptItem_DeliveryJustificationItem` (DeliveryJustificationItemID) -> VND.DeliveryJustificationItem (DeliveryJustificationItemID)
- **FK** `FK_TemporaryStockReceiptItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **Referenced by:** REQ.ReturnRequestItem (TemporaryStockReceiptItemID); STC.JustificationInputItem (TemporaryStockReceiptItemID); STC.ReturnedTemporaryStockReceiptItem (TemporaryStockReceiptItemID); STC.TemporaryStockReceiptItemTrace (TemporaryStockReceiptItemID)

### STC.TemporaryStockReceiptItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TemporaryStockReceiptItemTraceID | int | N |  | identity |
| 2 | TemporaryStockReceiptItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** TemporaryStockReceiptItemTraceID
- **FK** `FK_TemporaryStockReceiptItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceiptItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TemporaryStockReceiptItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TemporaryStockReceiptItemTrace_TemporaryStockReceiptItem` (TemporaryStockReceiptItemID) -> STC.TemporaryStockReceiptItem (TemporaryStockReceiptItemID) on delete CASCADE
- **FK** `FK_TemporaryStockReceiptItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_TemporaryStockReceiptItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

## Views

### STC.JustificationInput_non_StockReceipt

Definition: `programmability/views/STC.JustificationInput_non_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | JustificationInputItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### STC.JustificationInput_PurchaseInvoice

Definition: `programmability/views/STC.JustificationInput_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | JustificationInputItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | N |

### STC.JustificationInput_Remains

Definition: `programmability/views/STC.JustificationInput_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | JustificationInputItemID | int | N |
| 2 | DeliverDlID | bigint | N |
| 3 | Date | date | N |
| 4 | StockID | int | N |
| 5 | MainQuantity | decimal(36,10) | Y |
| 6 | DoMainQuantity | decimal(38,10) | Y |
| 7 | DoSubQuantity | decimal(38,10) | Y |
| 8 | Non | decimal(38,10) | Y |
| 9 | NonSub | decimal(38,10) | Y |

### STC.JustificationInput_StockReceipt

Definition: `programmability/views/STC.JustificationInput_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | JustificationInputItemID | int | Y |
| 2 | StockReceiptItemID | int | N |

### STC.StockReceipt_PurchaseInvoice

Definition: `programmability/views/STC.StockReceipt_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockReceiptItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | Y |
| 3 | PurchaseInvoiceID | int | N |
| 4 | StockReceiptID | int | N |

### STC.StockReceipt_Remains

Definition: `programmability/views/STC.StockReceipt_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockReceiptItemID | int | N |
| 2 | MainQuantity | decimal(36,10) | Y |
| 3 | DoMainQuantity | decimal(38,10) | N |
| 4 | DoSubQuantity | decimal(38,10) | N |
| 5 | Non | decimal(38,10) | Y |
| 6 | NonSub | decimal(38,10) | Y |

### STC.StockReceipt_ReturnRemains

Definition: `programmability/views/STC.StockReceipt_ReturnRemains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockReceiptItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | NonSub | decimal(38,4) | Y |

### STC.StockReceipt_ReturnRequest

Definition: `programmability/views/STC.StockReceipt_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockReceiptItemID | int | Y |
| 2 | ReturnRequestItemID | int | N |

### STC.TemporaryOutgoing_Remain

Definition: `programmability/views/STC.TemporaryOutgoing_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryOutgoingItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | NonSub | decimal(38,4) | Y |

### STC.TemporaryStockReceipt_JustificationInput

Definition: `programmability/views/STC.TemporaryStockReceipt_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | Y |
| 2 | JustificationInputItemID | int | N |

### STC.TemporaryStockReceipt_Non_JustificationInput

Definition: `programmability/views/STC.TemporaryStockReceipt_Non_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### STC.TemporaryStockReceipt_non_ReturnedTemporaryStockReceipt

Definition: `programmability/views/STC.TemporaryStockReceipt_non_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### STC.TemporaryStockReceipt_Non_ReturnRequest

Definition: `programmability/views/STC.TemporaryStockReceipt_Non_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### STC.TemporaryStockReceipt_PurchaseInvoice

Definition: `programmability/views/STC.TemporaryStockReceipt_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | N |

### STC.TemporaryStockReceipt_ReturnedTemporaryStockReceipt

Definition: `programmability/views/STC.TemporaryStockReceipt_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | Y |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |

### STC.TemporaryStockReceipt_ReturnRequest

Definition: `programmability/views/STC.TemporaryStockReceipt_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | Y |
| 2 | ReturnRequestItemID | int | N |

### STC.TemporaryStockReceipt_StockReceipt

Definition: `programmability/views/STC.TemporaryStockReceipt_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TemporaryStockReceiptItemID | int | Y |
| 2 | StockReceiptItemID | int | N |

### STC.VwCardex

Definition: `programmability/views/STC.VwCardex.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocName | varchar(18) | N |
| 2 | StockDocumentTypeID | int | Y |
| 3 | Date | date | N |
| 4 | Number | int | N |
| 5 | FinancialPeriodID | int | N |
| 6 | StockID | int | Y |
| 7 | StuffID | int | N |
| 8 | MainQuantity | decimal(36,10) | Y |
| 9 | SubQuantity | decimal(36,10) | Y |
| 10 | Amount | decimal(38,10) | Y |
| 11 | DlID | bigint | Y |
| 12 | HeaderID | int | N |
| 13 | ItemID | int | N |
| 14 | CompanyID | int | Y |

### STC.vwFindOutgoingItemByReturnSaleID

Definition: `programmability/views/STC.vwFindOutgoingItemByReturnSaleID.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnedSaleInvoiceItemID | int | Y |
| 2 | ReturnedSaleJustificationItemID | int | Y |
| 3 | OutgoingItemId | int | Y |

### STC.vwPricingStage

Definition: `programmability/views/STC.vwPricingStage.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Stage | nvarchar(MAX) | Y |
| 2 | Date | date | Y |
| 3 | Time | time(7) | Y |
| 4 | rn | bigint | Y |
| 5 | Diff | int | Y |

### STC.vwReturnedOutgoingItem_NotPlacedRemain

Definition: `programmability/views/STC.vwReturnedOutgoingItem_NotPlacedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnedOutgoingItemID | int | N |
| 2 | DoMainQuantity | decimal(38,4) | Y |
| 3 | DoSubQuantity | decimal(38,4) | Y |
| 4 | Remain | decimal(38,4) | Y |
| 5 | SubRemain | decimal(38,4) | Y |

### STC.vwReturnOutgoing_Outgoing

Definition: `programmability/views/STC.vwReturnOutgoing_Outgoing.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnedOutgoingItemID | int | N |
| 2 | OutgoingItemID | int | Y |
| 3 | Fee | decimal(36,10) | Y |

### STC.VwReturnStockReceiptItemsBasedOnPurchaseInvoiceItems

Definition: `programmability/views/STC.VwReturnStockReceiptItemsBasedOnPurchaseInvoiceItems.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnStockReceiptItemID | int | N |
| 2 | PurchaseInvoiceItemID | int | N |
| 3 | Fee | decimal(36,10) | Y |
| 4 | StuffID | int | N |
| 5 | Discount | decimal(36,10) | Y |

### STC.vwStockDocumentType

Definition: `programmability/views/STC.vwStockDocumentType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockDocumentTypeID | int | N |
| 2 | Type | tinyint | N |
| 3 | Title | nvarchar(256) | N |
| 4 | Title2 | nvarchar(256) | N |
| 5 | DocumentType | tinyint | N |
| 6 | DlTypeID | int | Y |
| 7 | SlBaseOnDl | bit | N |
| 8 | IsActive | bit | N |
| 9 | UniqueCode | nvarchar(61) | Y |

### STC.vwStockDocumentTypeBaseEntity

Definition: `programmability/views/STC.vwStockDocumentTypeBaseEntity.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | FullCode | nvarchar(MAX) | Y |
| 2 | StockDocumentTypeBaseEntityID | int | N |
| 3 | Title | nvarchar(256) | N |
| 4 | Title2 | nvarchar(256) | N |
| 5 | StockDocumentTypeID | int | N |
| 6 | BaseEntity | tinyint | N |
| 7 | Type | tinyint | N |

### STC.vwStockReceiptItem_NotPlacedRemain

Definition: `programmability/views/STC.vwStockReceiptItem_NotPlacedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StockReceiptItemID | int | N |
| 2 | DoMainQuantity | decimal(38,4) | Y |
| 3 | DoSubQuantity | decimal(38,4) | Y |
| 4 | Remain | decimal(38,4) | Y |
| 5 | SubRemain | decimal(38,4) | Y |

### STC.VWStockReceiptWithBase

Definition: `programmability/views/STC.VWStockReceiptWithBase.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | FinancialPeriodID | int | N |
| 2 | OriginDate | date | N |
| 3 | OriginStock | int | N |
| 4 | OriginStuff | int | N |
| 5 | OutgoingItemID | int | N |
| 6 | DestinationDate | date | N |
| 7 | DestinationStock | int | N |
| 8 | DestinationStuff | int | N |
| 9 | StockReceiptItemID | int | N |

