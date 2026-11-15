# Schema `STF`

## Tables

### STF.BarcodeInterpretation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BarcodeInterpretationID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(255) | N |  |  |
| 4 | Title2 | nvarchar(255) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** BarcodeInterpretationID
- **FK** `FK_BarcodeInterpretation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_BarcodeInterpretation_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.BarcodeInterpretationItem (BarcodeInterpretationID)

### STF.BarcodeInterpretationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BarcodeInterpretationItemID | int | N |  | identity |
| 2 | BarcodeInterpretationID | int | N |  |  |
| 3 | RowIndex | int | N | ((1)) |  |
| 4 | Type | int | N | ((5)) |  |
| 5 | TraceID | int | Y |  |  |
| 6 | Length | int | N |  |  |
| 7 | Position | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** BarcodeInterpretationItemID
- **FK** `FK_BarcodeInterpretationItem_BarcodeInterpretation` (BarcodeInterpretationID) -> STF.BarcodeInterpretation (BarcodeInterpretationID) on delete CASCADE
- **FK** `FK_BarcodeInterpretationItem_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_BarcodeInterpretationItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_BarcodeInterpretationItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### STF.MeasureUnit

Rows: 47 | واحد اندازه گیری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MeasureUnitID | int | N |  | identity |
| 2 | TaxCode | nvarchar(100) | Y |  |  |
| 3 | Title | nvarchar(256) | N |  | عنوان |
| 4 | Title2 | nvarchar(256) | N |  | عنوان2 |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Kilogram | decimal(36,10) | Y |  |  |
| 11 | UnitType | tinyint | Y |  |  |

- **Primary key:** MeasureUnitID
- **unique index** `IX_MeasureUnitTitle` (Title)
- **unique index** `IX_MeasureUnitTitle2` (Title2)
- **FK** `FK_MeasureUnit_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MeasureUnit_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.BomGroup (MeasureUnitID); STF.MeasureUnitTrace (MeasureUnitID); STF.Stuff (MainMeasureUnitID); STF.Stuff (WeightUnitID); STF.StuffDetail (MeasureSubUnitID)

### STF.MeasureUnitTrace

Rows: 0 | ویژگیهایی که در فرمول واحد سنجش استفاده شده اند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MeasureUnitTraceID | int | N |  | identity |
| 2 | MeasureUnitID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** MeasureUnitTraceID
- **unique index** `IX_MeasureUnitIdAndTraceId` (MeasureUnitID, TraceID)
- **FK** `FK_MeasureUnitTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MeasureUnitTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MeasureUnitTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_MeasureUnitTrace_MeasureUnit` (MeasureUnitID) -> STF.MeasureUnit (MeasureUnitID) on delete CASCADE

### STF.Property

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PropertyID | int | N |  | identity |
| 2 | Title | nvarchar(254) | N |  |  |
| 3 | Title2 | nvarchar(254) | N |  |  |
| 4 | AccountLevelTypeID | smallint | N |  |  |
| 5 | ApplyTitleInStandard | bit | N |  |  |
| 6 | ApplyPropertyValueInStandard | bit | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | IncludeInCommodityCode | bit | N | ((0)) |  |

- **Primary key:** PropertyID
- **FK** `FK_Property_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Property_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.StuffGroupProperty (PropertyID); STF.StuffPropertyValue (PropertyID)

### STF.PursuitGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PursuitGroupID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(255) | N |  |  |
| 4 | Title2 | nvarchar(255) | N |  |  |
| 5 | HasStock | bit | N |  |  |
| 6 | HasDocument | bit | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |

- **Primary key:** PursuitGroupID
- **FK** `FK_PursuitGroup_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_PursuitGroup_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.PursuitGroupStock (PursuitGroupID); STF.StuffPursuitGroup (PursuitGroupID)

### STF.PursuitGroupStock

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PursuitGroupStockID | int | N |  | identity |
| 2 | PursuitGroupID | int | N |  |  |
| 3 | LastEditionDate | datetime | N |  |  |
| 4 | StockID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |

- **Primary key:** PursuitGroupStockID
- **FK** `FK_PursuitGroupStock_PursuitGroup` (PursuitGroupID) -> STF.PursuitGroup (PursuitGroupID) on delete CASCADE
- **FK** `FK_PursuitGroupStock_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_PursuitGroupStock_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_PursuitGroupStock_LastEditorUser` (LastEditor) -> CFG.User (UserID)

### STF.SerialPattern

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SerialPatternID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(400) | N |  |  |
| 4 | Title2 | nvarchar(400) | N |  |  |
| 5 | IsActive | bit | N |  |  |
| 6 | PatternLen | int | N |  |  |
| 7 | Status | tinyint | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** SerialPatternID
- **FK** `FK_SerialPattern_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_SerialPattern_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.SerialPatternItem (SerialPatternID); STF.StuffSerial (SerialPatternID)

### STF.SerialPatternItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SerialPatternItemID | int | N |  | identity |
| 2 | SerialPatternID | int | N |  |  |
| 3 | RowNumber | int | N |  |  |
| 4 | Type | smallint | Y |  |  |
| 5 | Value | nvarchar(50) | Y |  |  |
| 6 | CharLength | int | Y |  |  |
| 7 | FillingChar | nvarchar(10) | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** SerialPatternItemID
- **FK** `FK_SerialPatternItem_SerialPattern` (SerialPatternID) -> STF.SerialPattern (SerialPatternID) on delete CASCADE
- **FK** `FK_SerialPatternItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_SerialPatternItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### STF.Stock

Rows: 11

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  | عنوان |
| 3 | Title2 | nvarchar(256) | N |  | عنوان2 |
| 4 | BranchID | int | N |  | شعبه |
| 5 | Code | int | N |  | کد انبار |
| 6 | Supervisor | nvarchar(256) | Y |  | سرپرست |
| 7 | Phone | nvarchar(50) | Y |  | تلفن |
| 8 | Address | nvarchar(256) | Y |  | آدرس |
| 9 | IsStockDefault | bit | N |  | انبار پیش فرض |
| 10 | IsActive | bit | N |  | فعال |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | NegativeInventoryChecking | bit | N | ((0)) |  |
| 17 | HasZone | bit | N | ((0)) |  |
| 18 | StockTypeID | int | Y |  |  |

- **Primary key:** StockID
- **unique index** `IX_Title` (Title)
- **unique index** `IX_Title2` (Title2)
- **index** `IX_StockTypeID` (StockTypeID)
- **FK** `FK_Stock_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Stock_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Stock_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Stock_StockTypeID` (StockTypeID) -> STF.StockType (StockTypeID)
- **Referenced by:** POS.PosInvoice (StockID); POS.Station (StockID); REQ.ReturnRequest (StockID); REQ.StuffRequest (FromStockID); REQ.StuffRequest (ToStockID); SLE.Remittance (StockID); STC.InventoryEdition (StockID); STC.InventoryMethodStock (StockID); STC.JustificationInput (StockID); STC.Outgoing (DeliverStockID); STC.Outgoing (StockID); STC.PricingItem (StockID); STC.RecountingInventoryPeriod (StockID); STC.ReturnedOutgoing (StockDeliverID); STC.ReturnedOutgoing (StockID); STC.ReturnedTemporaryOutgoing (StockID); STC.ReturnedTemporaryStockReceipt (StockID); STC.ReturnStockReceipt (DeliverStockID); STC.ReturnStockReceipt (StockID); STC.StockClosePeriod (StockID); STC.StockClosingOperation (StockID); STC.StockReceipt (DeliverStockID); STC.StockReceipt (StockID); STC.TemporaryOutgoing (StockID); STC.TemporaryStockReceipt (StockID); STF.PursuitGroupStock (StockID); WMS.Packing (StockID); WMS.PhysicalLocation (StockID); WMS.WarehouseSpaceDesign (StockID); WMS.Zone (StockID)

### STF.StockDocumentTypeSlDl

Rows: 500

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockDocumentTypeSlDlID | int | N |  | identity |
| 2 | StockDocumentTypeID | int | N |  |  |
| 3 | DlID | bigint | Y |  |  |
| 4 | SlID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | StuffAccountGroupID | int | N |  |  |

- **Primary key:** StockDocumentTypeSlDlID
- **unique index** `IX_Unique_StockDocumentTypeSlDl_StuffAccountGroupID_StockDocumentTypeID_DlID` (StuffAccountGroupID, StockDocumentTypeID, DlID)
- **FK** `FK_StockDocumentTypeSlDl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockDocumentTypeSlDl_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StockDocumentTypeSlDl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StockDocumentTypeSlDl_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_StockDocumentTypeSlDl_StuffAccountGroup` (StuffAccountGroupID) -> STF.StuffAccountGroup (StuffAccountGroupID) on delete CASCADE
- **FK** `FK_StockDocumentTypeSlDl_StockDocumentType` (StockDocumentTypeID) -> STC.StockDocumentType (StockDocumentTypeID) on delete CASCADE

### STF.StockType

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StockTypeID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StockTypeID
- **FK** `FK_StockType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StockType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.Stock (StockTypeID); STF.StuffAccountGroupAccountSl (StockTypeID)

### STF.Stuff

Rows: 4694 | کالا

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffID | int | N |  | identity |
| 2 | Type | tinyint | N | ((0)) | کالا = 0 خدمات = 1 |
| 3 | Code | nvarchar(256) | N |  | کد |
| 4 | StuffGroupID | int | Y |  | ID گروه کالا |
| 5 | Title | nvarchar(MAX) | Y |  | عنوان |
| 6 | Title2 | nvarchar(MAX) | Y |  | عنوان2 |
| 7 | ExemptOfPurchaseVat | bit | N |  | معاف از ارزش افزوده خرید |
| 8 | ExemptOfSellVat | bit | N |  | معاف از ارزش افزوده فروش |
| 9 | MainMeasureUnitID | int | N |  | واحد اصلی |
| 10 | IsActive | bit | N |  | فعال |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | StockReceiptCostAgent | bit | N |  |  |
| 17 | IsSpecialStuff | bit | N | ((0)) |  |
| 18 | DutyRate | decimal(18,4) | Y |  |  |
| 19 | TaxRate | decimal(18,4) | Y |  |  |
| 20 | FixedAssetConversion | bit | N | ((0)) |  |
| 21 | TopicTitle | nvarchar(MAX) | Y |  |  |
| 22 | TopicTitle2 | nvarchar(MAX) | Y |  |  |
| 23 | StandardTitle | nvarchar(MAX) | Y |  |  |
| 24 | StandardTitle2 | nvarchar(MAX) | Y |  |  |
| 25 | StuffNature | tinyint | N |  |  |
| 26 | ParentID | int | Y |  |  |
| 27 | UniqueTaxID | nvarchar(255) | Y |  |  |
| 28 | WeightUnitID | int | Y |  |  |
| 29 | WeighRatio | decimal(36,10) | Y |  |  |

- **Primary key:** StuffID
- **FK** `FK_Stuff_MainMeasureUnit` (MainMeasureUnitID) -> STF.MeasureUnit (MeasureUnitID)
- **FK** `FK_Stuff_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Stuff_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Stuff_StuffGroup` (StuffGroupID) -> STF.StuffGroup (StuffGroupID)
- **FK** `FK_Stuff_WeitghtUnit` (WeightUnitID) -> STF.MeasureUnit (MeasureUnitID)
- **Referenced by:** APS.DimSaleItem (StuffID); AST.Asset (StuffID); AST.AssetItem (StuffID); AST.AssetReceiptItem (StuffID); AST.AssetReceiptUtilizationCost (StuffID); AST.Creation (StuffID); AST.RepairServiceCost (StuffID); AST.UtilizationCost (StuffID); CNT.ContractSubject (StuffID); CTM.OrderItem (StuffID); CTM.ReceptionItem (StuffID); FOS.LetterCreditBankCost (StuffID); FOS.ProformaInvoiceItem (StuffID); PMO.ProjectActivity (StuffID); POS.OrderFoodItem (StuffID); POS.PosInvoiceItem (StuffID); POS.StationFixService (ServiceID); POS.StationPrintGroupStuff (StuffID); POS.StationVitrinItem (StuffID); PRM.CalculatedConversionCost (StuffID); PRM.CalculatedMaterialCost (MaterialID); PRM.CalculatedMaterialCost (StuffID); PRM.ConsumptionStatisticItem (StuffID); PRM.CostDriverPeriodData (StuffID); PRM.MaterialPlanningSetting (StuffID); PRM.PlanningItem (StuffID); PRM.ProductionAnalysisItem (StuffID); PRM.ProductionDeliveryItem (StuffID); PRM.ProductionFormula (StuffID); PRM.ProductionFormulaItemMaterial (StuffID); PRM.ProductionOrderItem (StuffID); PRM.ProductionPlanningItem (StuffID); PRM.ProductionStatisticItem (StuffID); PRM.ProductionTiming (StuffID); PRM.RepairRequirementItem (StuffID); PRM.RequiredMaterial (StuffID); PRM.RequiredProduct (StuffID); PRM.ReworkItem (StuffID); PRM.SpoilageStatisticItem (StuffID); PRM.StandardConsumptionItem (StuffID); PRM.StationPerformanceItem (StuffID); PRM.StuffBomGroup (StuffID); PRM.WorkingInventoryItem (StuffID); REQ.PurchaseRequestItem (StuffID); REQ.ReturnRequestItem (StuffID); REQ.ServiceRequestItem (StuffID); REQ.StuffRequestItem (StuffID); REQ.TenderRequestItem (StuffID); SLE.DiscountAnnouncement (StuffID); SLE.InvoiceItem (StuffID); SLE.JustificationItem (StuffID); SLE.PercentagePriceListItem (StuffID); SLE.PercentagePriceListItemBase (StuffID); SLE.PourcentageParameterMethod (StuffID); SLE.PourcentageRate (StuffID); SLE.PriceListItem (StuffID); SLE.PricingCalculationItem (StuffID); SLE.PricingParameter (StuffID); SLE.QuotationItem (StuffID); SLE.RemittanceItem (StuffID); SLE.ReturnedSaleInvoiceItem (StuffID); SLE.ReturnedSaleJustificationItem (StuffID); SLE.SaleContractItem (StuffID); STC.ConvertSpecification (StuffID); STC.InventoryEditionItem (StuffID); STC.JustificationInputItem (StuffID); STC.OutgoingItem (StuffID); STC.PricingItem (StuffID); STC.ProductionPriceItem (StuffID); STC.ReceiptCost (StuffID); STC.RecountingInventoryTagItem (StuffID); STC.ReturnedOutgoingItem (StuffID); STC.ReturnedTemporaryStockReceiptItem (StuffID); STC.ReturnStockReceiptItem (StuffID); STC.StockReceiptItem (StuffID); STC.StuffComposition (StuffID); STC.TemporaryOutgoingItem (StuffID); STC.TemporaryStockReceiptItem (StuffID); STF.StuffDetail (DamageStuffID); STF.StuffDetail (StuffID); STF.StuffImage (StuffID); STF.StuffPropertyValue (StuffID); STF.StuffPursuitGroup (StuffID); STF.StuffSerial (StuffID); STF.StuffTrace (StuffID); VND.DeliveryJustificationItem (StuffID); VND.ProposalItem (StuffID); VND.PurchaseContractItem (StuffID); VND.PurchaseInvoiceItem (StuffID); VND.PurchasePlanningItem (StuffID); VND.ReturnInvoiceItem (StuffID); WMS.Warehousing (StuffID); WMS.ZoneInventory (StuffID)

### STF.StuffAccountGroup

Rows: 82

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffAccountGroupID | int | N |  | identity |
| 2 | Code | int | N | ((1)) |  |
| 3 | Title | nvarchar(256) | N |  | عنوان |
| 4 | Title2 | nvarchar(256) | N |  | عنوان2 |
| 5 | PricingType | tinyint | N |  | روش قیمت گذاری |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | StuffDetailType | tinyint | N | ((0)) |  |
| 12 | ExchangeSlID | int | Y |  |  |
| 13 | AdjustmentSLID | int | Y |  | معین تعدیلات سنواتی |

- **Primary key:** StuffAccountGroupID
- **unique index** `IX_StuffAccountGroupTitle` (Title)
- **unique index** `IX_StuffAccountGroupTitle2` (Title2)
- **FK** `FK_StuffAccountGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroup_AdjustmentSL` (AdjustmentSLID) -> ACC.SL (SlID)
- **Referenced by:** STF.StockDocumentTypeSlDl (StuffAccountGroupID); STF.StuffAccountGroupAccountSl (StuffAccountGroupID); STF.StuffAccountGroupPurchaseType (StuffAccountGroupID); STF.StuffDetail (StuffAccountGroupID); STF.StuffSaleSl (StuffAccountGroupID)

### STF.StuffAccountGroupAccountSl

Rows: 82

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffAccountGroupAccountSlID | int | N |  | identity |
| 2 | InventorySlID | int | Y |  |  |
| 3 | StockTypeID | int | N |  |  |
| 4 | StuffAccountGroupID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StuffAccountGroupAccountSlID
- **index** `IX_StuffAccountGroupID` (StuffAccountGroupID)
- **FK** `FK_StuffAccountGroupAccountSl_StockTypeID` (StockTypeID) -> STF.StockType (StockTypeID)
- **FK** `FK_StuffAccountGroupAccountSl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroupAccountSl_InventorySL` (InventorySlID) -> ACC.SL (SlID)
- **FK** `FK_StuffAccountGroupAccountSl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroupAccountSl_StuffAccountGroup` (StuffAccountGroupID) -> STF.StuffAccountGroup (StuffAccountGroupID) on delete CASCADE

### STF.StuffAccountGroupPurchaseType

Rows: 406

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffAccountGroupPurchaseTypeID | int | N |  | identity |
| 2 | StuffAccountGroupID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | PurchaseTypeID | tinyint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StuffAccountGroupPurchaseTypeID
- **index** `IX_StuffAccountGroupID` (StuffAccountGroupID)
- **FK** `FK_StuffAccountGroupPurchaseType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroupPurchaseType_PurchaseType` (PurchaseTypeID) -> VND.PurchaseType (PurchaseTypeID)
- **FK** `FK_StuffAccountGroupPurchaseType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffAccountGroupPurchaseType_InventorySL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_StuffAccountGroupPurchaseType_StuffAccountGroup` (StuffAccountGroupID) -> STF.StuffAccountGroup (StuffAccountGroupID) on delete CASCADE

### STF.StuffDetail

Rows: 4694

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffID | int | N |  |  |
| 2 | StuffAccountGroupID | int | Y |  | گروه حساب |
| 3 | Barcode | nvarchar(50) | Y |  |  |
| 4 | IranCode | nvarchar(50) | Y |  |  |
| 5 | Saleable | bit | N |  | قابل فروش |
| 6 | MeasureSubUnitID | int | Y |  | واحد فرعی |
| 7 | ConvertRatio | decimal(10,3) | Y |  | نسبت تبدیل |
| 8 | IsStable | bit | Y |  | ثابت یا متغییر بودن نسبت تبدیل |
| 9 | MinContorol | bit | Y |  | کنترل حداقل موجودی |
| 10 | ControlType | tinyint | Y |  | هشدار - بازدارنده - هیچکدام |
| 11 | MinValue | decimal(30,4) | Y |  | مقدار حداقل موجودی |
| 12 | MaxValue | decimal(30,4) | Y |  | حداکثر موجودی |
| 13 | SalesGroupID | int | Y |  |  |
| 14 | CommissionGroupID | int | Y |  |  |
| 15 | BuyGroupID | int | Y |  |  |
| 16 | DiscountGroupID | int | Y |  |  |
| 17 | OrderPoint | decimal(30,4) | Y |  | نقطه سفارش |
| 18 | Version | int | N |  |  |
| 19 | Creator | int | N |  |  |
| 20 | CreationDate | datetime | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | DamageStuffID | int | Y |  | کد معادل ضایعاتی |
| 24 | MainToSpoilageConvertRatio | decimal(20,10) | Y |  |  |
| 25 | SlID | int | Y |  |  |
| 26 | TechnicalCode | nvarchar(50) | Y |  |  |
| 27 | PorcumentGroupID | int | Y |  |  |
| 28 | IsStuffSerializable | bit | N |  |  |

- **Primary key:** StuffID
- **FK** `FK_StuffDetail_SubMeasureUnit` (MeasureSubUnitID) -> STF.MeasureUnit (MeasureUnitID)
- **FK** `FK_StuffDetail_StuffAccountGroup` (StuffAccountGroupID) -> STF.StuffAccountGroup (StuffAccountGroupID)
- **FK** `FK_StuffDetail_BuyGroup` (BuyGroupID) -> CFG.Group (GroupID)
- **FK** `FK_StuffDetail_CommissionGroup` (CommissionGroupID) -> CFG.Group (GroupID)
- **FK** `FK_StuffDetail_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffDetail_DamageStuff` (DamageStuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StuffDetail_DiscountGroup` (DiscountGroupID) -> CFG.Group (GroupID)
- **FK** `FK_StuffDetail_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffDetail_SalesGroup` (SalesGroupID) -> CFG.Group (GroupID)
- **FK** `FK_StuffDetail_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_StuffDetail_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE
- **FK** `FK_StuffDetail_PorcumentGroup` (PorcumentGroupID) -> VND.PorcumentGroup (PorcumentGroupID)

### STF.StuffDetailType

Rows: 6

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffDetailTypeID | smallint | N |  |  |
| 2 | EngName | varchar(256) | N |  |  |
| 3 | Name | nvarchar(256) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** StuffDetailTypeID
- **FK** `FK_StuffDetailType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffDetailType_LastEditor` (LastEditor) -> CFG.User (UserID)

### STF.StuffGroup

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffGroupID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Code | nvarchar(256) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Type | tinyint | Y |  |  |

- **Primary key:** StuffGroupID
- **unique index** `IX_StuffGroupCode` (Code, ParentID)
- **unique index** `IX_StuffGroupTitle` (Title, ParentID)
- **unique index** `IX_StuffGroupTitle2` (Title2, ParentID)
- **FK** `FK_StuffGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffGroup_Parent` (ParentID) -> STF.StuffGroup (StuffGroupID)
- **Referenced by:** REQ.TenderRequestItem (StuffGroupID); STF.Stuff (StuffGroupID); STF.StuffGroup (ParentID); STF.StuffGroupProperty (StuffGroupID)

### STF.StuffGroupProperty

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffGroupPropertyID | int | N |  | identity |
| 2 | StuffGroupID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PropertyID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | StuffNature | tinyint | N |  |  |
| 11 | IsMandetory | bit | N | ((0)) |  |
| 12 | TraceListTypeID | int | Y |  |  |

- **Primary key:** StuffGroupPropertyID
- **FK** `FK_StuffGroupProperty_Property` (PropertyID) -> STF.Property (PropertyID)
- **FK** `FK_StuffGroupProperty_StuffGroup` (StuffGroupID) -> STF.StuffGroup (StuffGroupID) on delete CASCADE
- **FK** `FK_StuffGroupProperty_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffGroupProperty_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffGroupProperty_TraceListType` (TraceListTypeID) -> STF.TraceListType (TraceListTypeID)

### STF.StuffImage

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffID | int | N |  |  |
| 2 | Image | image | Y |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StuffID
- **FK** `FK_StuffImage_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffImage_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffImage_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE

### STF.StuffPropertyValue

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffPropertyValueID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | Value | nvarchar(MAX) | Y |  |  |
| 4 | Value2 | nvarchar(MAX) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | PropertyID | int | Y |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** StuffPropertyValueID
- **FK** `FK_StuffPropertyValue_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_StuffPropertyValue_Property` (PropertyID) -> STF.Property (PropertyID)
- **FK** `FK_StuffPropertyValue_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE
- **FK** `FK_StuffPropertyValue_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffPropertyValue_EditorUser` (LastEditor) -> CFG.User (UserID)

### STF.StuffPursuitGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffPursuitGroupID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | PursuitGroupID | int | N |  |  |
| 4 | LastEditionDate | datetime | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |

- **Primary key:** StuffPursuitGroupID
- **FK** `FK_StuffPursuitGroup_PursuitGroup` (PursuitGroupID) -> STF.PursuitGroup (PursuitGroupID)
- **FK** `FK_StuffPursuitGroup_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE
- **FK** `FK_StuffPursuitGroup_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffPursuitGroup_LastEditorUser` (LastEditor) -> CFG.User (UserID)

### STF.StuffSaleSl

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffSaleSlID | int | N |  | identity |
| 2 | StuffAccountGroupID | int | N |  |  |
| 3 | SaleModelID | smallint | N |  |  |
| 4 | SaleSlID | int | N |  |  |
| 5 | ReturnedSaleSlID | int | N |  |  |
| 6 | DiscountSlID | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StuffSaleSlID
- **FK** `FK_StuffSaleSl_StuffAccountGroup` (StuffAccountGroupID) -> STF.StuffAccountGroup (StuffAccountGroupID) on delete CASCADE
- **FK** `FK_StuffSaleSl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffSaleSl_DiscountSl` (DiscountSlID) -> ACC.SL (SlID)
- **FK** `FK_StuffSaleSl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffSaleSl_ReturnedSaleSl` (ReturnedSaleSlID) -> ACC.SL (SlID)
- **FK** `FK_StuffSaleSl_SaleModel` (SaleModelID) -> SLE.SaleModel (SaleModelID)
- **FK** `FK_StuffSaleSl_SaleSl` (SaleSlID) -> ACC.SL (SlID)

### STF.StuffSerial

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffSerialID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | SerialPatternID | int | Y |  |  |
| 4 | SerialValue | nvarchar(400) | N |  |  |
| 5 | Seri | int | N |  |  |
| 6 | UsageStatus | tinyint | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Step | int | N | ((1)) |  |
| 13 | Batch | nvarchar(250) | Y |  |  |
| 14 | ProductionDate | nvarchar(250) | Y |  |  |
| 15 | ExpirationDate | nvarchar(250) | Y |  |  |
| 16 | Description | nvarchar(MAX) | Y |  |  |
| 17 | Description2 | nvarchar(MAX) | Y |  |  |

- **Primary key:** StuffSerialID
- **FK** `FK_StuffSerial_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StuffSerial_SerialPattern` (SerialPatternID) -> STF.SerialPattern (SerialPatternID)
- **FK** `FK_StuffSerial_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffSerial_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STC.OutgoingSerialSpecification (StuffSerialID); STC.ReturnedOutgoingSerialSpecification (StuffSerialID); STC.ReturnStockReceiptSerialSpecification (StuffSerialID); STC.StockReceiptSerialSpecification (StuffSerialID)

### STF.StuffTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffTraceID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | TraceListTypeID | int | Y | ((1)) |  |
| 10 | SalePriceBase | bit | N | ((1)) |  |

- **Primary key:** StuffTraceID
- **unique index** `IX_StuffIdAndTraceId` (TraceID, StuffID)
- **FK** `FK_StuffTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffTrace_Stuff` (StuffID) -> STF.Stuff (StuffID) on delete CASCADE
- **FK** `FK_StuffTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_StuffTrace_TraceListType` (TraceListTypeID) -> STF.TraceListType (TraceListTypeID)

### STF.Trace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TraceID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | AccountLevelTypeID | smallint | N |  | نوع |
| 5 | DlTypeID | int | Y |  |  |
| 6 | PricingBase | bit | N |  | مبنای قیمت گذاری |
| 7 | MainMeasureUnitCalculatingBase | bit | N |  | مبنای محاسبه واحد اصلی |
| 8 | TraceOrder | int | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Alias | char(1) | Y |  |  |
| 15 | OrderView | int | N |  |  |
| 16 | CheckInventory | bit | N | ((1)) |  |
| 17 | EffectiveInPricing | bit | N | ((1)) |  |
| 18 | IsEffectiveInProduceCost | bit | N | ((0)) |  |
| 19 | IsEffectiveInConsumeCost | bit | N | ((0)) |  |

- **Primary key:** TraceID
- **unique index** `IX_TraceTitle` (Title)
- **unique index** `IX_TraceTitle2` (Title2)
- **FK** `FK_Trace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Trace_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_Trace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.OrderItemTrace (TraceID); CTM.ReceptionItemTrace (TraceID); PRM.ConsumptionStatisticItemTrace (TraceID); PRM.PlanningItemTrace (TraceID); PRM.ProductionAnalysisItemTrace (TraceID); PRM.ProductionDeliveryItemTrace (TraceID); PRM.ProductionFormulaItemMaterialTrace (TraceID); PRM.ProductionFormulaTrace (TraceID); PRM.ProductionOrderItemTrace (TraceID); PRM.ProductionPlanningItemTrace (TraceID); PRM.ProductionStatisticItemTrace (TraceID); PRM.ProductionTimingTrace (TraceID); PRM.RequiredMaterialTrace (TraceID); PRM.RequiredProductTrace (TraceID); PRM.ReworkItemTrace (TraceID); PRM.SpoilageStatisticItemTrace (TraceID); PRM.StationPerformanceItemTrace (TraceID); PRM.WorkingInventoryItemTrace (TraceID); REQ.PurchaseRequestItemTrace (TraceID); REQ.ReturnRequestItemTrace (TraceID); REQ.StuffRequestItemTrace (TraceID); SLE.InvoiceItemTrace (TraceID); SLE.JustificationItemTrace (TraceID); SLE.PercentagePriceListItemBaseTrace (TraceID); SLE.PercentagePriceListItemTrace (TraceID); SLE.PriceListItemTrace (TraceID); SLE.QuotationItemTrace (TraceID); SLE.RemittanceItemTrace (TraceID); SLE.ReturnedSaleInvoiceItemTrace (TraceID); SLE.ReturnedSaleJustificationItemTrace (TraceID); SLE.SaleContractItemTrace (TraceID); STC.ConvertSpecificationTrace (TraceID); STC.InventoryEditionItemTrace (TraceID); STC.JustificationInputItemTrace (TraceID); STC.OutgoingItemTrace (TraceID); STC.PricingItemTrace (TraceID); STC.ProductionPriceItemTrace (TraceID); STC.RecountingInventoryTagItemTrace (TraceID); STC.ReturnedOutgoingItemTrace (TraceID); STC.ReturnedTemporaryStockReceiptItemTrace (TraceID); STC.ReturnStockReceiptItemTrace (TraceID); STC.StockReceiptItemTrace (TraceID); STC.StuffCompositionTrace (TraceID); STC.TemporaryOutgoingItemTrace (TraceID); STC.TemporaryStockReceiptItemTrace (TraceID); STF.BarcodeInterpretationItem (TraceID); STF.MeasureUnitTrace (TraceID); STF.StuffTrace (TraceID); STF.TraceDocumentNumType (TraceID)

### STF.TraceDocumentNumType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TraceDocumentNumTypeID | int | N |  | identity |
| 2 | TraceID | int | N |  |  |
| 3 | DocumentNumTypeID | smallint | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | IsAutoGenerated | bit | N | ((0)) |  |

- **Primary key:** TraceDocumentNumTypeID
- **FK** `FK_TraceDocumentNumType_Trace` (TraceID) -> STF.Trace (TraceID) on delete CASCADE
- **FK** `FK_TraceDocumentNumType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TraceDocumentNumType_DocumentNumType` (DocumentNumTypeID) -> CFG.DocumentNumType (DocumentNumTypeID)
- **FK** `FK_TraceDocumentNumType_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.TraceGenerateConfig (TraceDocumentNumTypeID)

### STF.TraceGenerateConfig

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TraceGenerateConfigID | int | N |  | identity |
| 2 | TraceDocumentNumTypeID | int | N |  |  |
| 3 | Parameter | tinyint | N |  |  |
| 4 | Order | tinyint | N |  |  |
| 5 | Length | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |

- **Primary key:** TraceGenerateConfigID
- **FK** `FK_TraceGenerateConfig_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TraceGenerateConfig_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TraceGenerateConfig_TraceDocumentNumType` (TraceDocumentNumTypeID) -> STF.TraceDocumentNumType (TraceDocumentNumTypeID) on delete CASCADE

### STF.TraceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TraceItemID | int | N |  | identity |
| 2 | RowIndex | smallint | N |  |  |
| 3 | Item | nvarchar(1024) | N |  |  |
| 4 | Item2 | nvarchar(1024) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | TraceListTypeID | int | N |  |  |
| 11 | Code | nvarchar(255) | N |  |  |

- **Primary key:** TraceItemID
- **unique index** `IX_TraceItem_Item_TraceListTypeID` (Item, TraceListTypeID)
- **unique index** `IX_TraceItem_Item2_TraceListTypeID` (Item2, TraceListTypeID)
- **FK** `FK_TraceItem_TraceListType` (TraceListTypeID) -> STF.TraceListType (TraceListTypeID) on delete CASCADE
- **FK** `FK_TraceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TraceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CTM.OrderItemTrace (TraceItemID); CTM.ReceptionItemTrace (TraceItemID); POS.PosInvoiceItemTrace (TraceItemID); PRM.ConsumptionStatisticItemTrace (TraceItemID); PRM.PlanningItemTrace (TraceItemID); PRM.ProductionAnalysisItemTrace (TraceItemID); PRM.ProductionDeliveryItemTrace (TraceItemID); PRM.ProductionFormulaItemMaterialTrace (TraceItemID); PRM.ProductionFormulaTrace (TraceItemID); PRM.ProductionOrderItemTrace (TraceItemID); PRM.ProductionPlanningItemTrace (TraceItemID); PRM.ProductionStatisticItemTrace (TraceItemID); PRM.ProductionTimingTrace (TraceItemID); PRM.RequiredMaterialTrace (TraceItemID); PRM.RequiredProductTrace (TraceItemID); PRM.ReworkItemTrace (TraceItemID); PRM.SpoilageStatisticItemTrace (TraceItemID); PRM.StationPerformanceItemTrace (TraceItemID); PRM.WorkingInventoryItemTrace (TraceItemID); REQ.PurchaseRequestItemTrace (TraceItemID); REQ.ReturnRequestItemTrace (TraceItemID); REQ.StuffRequestItemTrace (TraceItemID); SLE.InvoiceItemTrace (TraceItemID); SLE.JustificationItemTrace (TraceItemID); SLE.PercentagePriceListItemBaseTrace (TraceItemID); SLE.PercentagePriceListItemTrace (TraceItemID); SLE.PriceListItemTrace (TraceItemID); SLE.QuotationItemTrace (TraceItemID); SLE.RemittanceItemTrace (TraceItemID); SLE.ReturnedSaleInvoiceItemTrace (TraceItemID); SLE.ReturnedSaleJustificationItemTrace (TraceItemID); SLE.SaleContractItemTrace (TraceItemID); STC.ConvertSpecificationTrace (TraceItemID); STC.InventoryEditionItemTrace (TraceItemID); STC.JustificationInputItemTrace (TraceItemID); STC.OutgoingItemTrace (TraceItemID); STC.PricingItemTrace (TraceItemID); STC.ProductionPriceItemTrace (TraceItemID); STC.RecountingInventoryTagItemTrace (TraceItemID); STC.ReturnedOutgoingItemTrace (TraceItemID); STC.ReturnedTemporaryStockReceiptItemTrace (TraceItemID); STC.ReturnStockReceiptItemTrace (TraceItemID); STC.StockReceiptItemTrace (TraceItemID); STC.StuffCompositionTrace (TraceItemID); STC.TemporaryOutgoingItemTrace (TraceItemID); STC.TemporaryStockReceiptItemTrace (TraceItemID); STF.StuffPropertyValue (TraceItemID)

### STF.TraceListType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TraceListTypeID | int | N |  | identity |
| 2 | Title | nvarchar(255) | N |  |  |
| 3 | Title2 | nvarchar(255) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TraceListTypeID
- **FK** `FK_TraceListType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TraceListType_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** STF.StuffGroupProperty (TraceListTypeID); STF.StuffTrace (TraceListTypeID); STF.TraceItem (TraceListTypeID)

## Views

### STF.StuffTraceDocumentNum

Definition: `programmability/views/STF.StuffTraceDocumentNum.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ID | bigint | Y |
| 2 | StuffTraceID | int | N |
| 3 | TraceDocumentNumTypeID | int | N |
| 4 | DocumentNumTypeID | smallint | N |
| 5 | IsMandetory | bit | Y |

### STF.VWStuff

Definition: `programmability/views/STF.VWStuff.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffID | int | N |
| 2 | Type | tinyint | N |
| 3 | TypeString | tinyint | N |
| 4 | code | nvarchar(MAX) | N |
| 5 | StuffGroupID | int | Y |
| 6 | StuffCode | nvarchar(256) | N |
| 7 | StuffGroupCode | nvarchar(200) | Y |
| 8 | StuffGroupTitle | nvarchar(256) | Y |
| 9 | StuffGroupTitle2 | nvarchar(256) | Y |
| 10 | Title | nvarchar(MAX) | N |
| 11 | Title2 | nvarchar(MAX) | N |
| 12 | MainMeasureUnit | nvarchar(256) | N |
| 13 | MainMeasureUnit2 | nvarchar(256) | N |
| 14 | SubMeasureUnit | nvarchar(256) | Y |
| 15 | SubMeasureUnit2 | nvarchar(256) | Y |
| 16 | StuffDetailTypeTitle | nvarchar(16) | Y |
| 17 | StuffDetailType | tinyint | Y |
| 18 | StuffAccountGroupCode | int | Y |
| 19 | StuffAccountGroupTitle | nvarchar(256) | Y |
| 20 | StuffAccountGroupTitle2 | nvarchar(256) | Y |
| 21 | Barcode | nvarchar(50) | Y |
| 22 | IranCode | nvarchar(50) | Y |
| 23 | SalesGroupCode | int | Y |
| 24 | SalesGroupTitle | nvarchar(256) | Y |
| 25 | SalesGroupTitle2 | nvarchar(256) | Y |
| 26 | TechnicalCode | nvarchar(50) | Y |
| 27 | StuffNature | tinyint | N |
| 28 | DutyRate | decimal(18,4) | Y |
| 29 | TaxRate | decimal(18,4) | Y |
| 30 | ExemptOfPurchaseVat | bit | N |
| 31 | ExemptOfSellVat | bit | N |
| 32 | MainMeasureUnitID | int | N |
| 33 | StockReceiptCostAgent | bit | N |
| 34 | FixedAssetConversion | bit | N |
| 35 | DiscountGroupID | int | Y |
| 36 | Saleable | bit | N |
| 37 | ConvertRatio | decimal(10,3) | Y |
| 38 | IsStable | bit | Y |
| 39 | MeasureSubUnitID | int | Y |
| 40 | StuffAccountGroupID | int | Y |
| 41 | ParentID | int | Y |
| 42 | SalesGroupID | int | Y |
| 43 | IsActive | bit | N |
| 44 | IsSpecialStuff | bit | N |
| 45 | MainUnitKilogram | decimal(36,10) | Y |
| 46 | SubUnitKilogram | decimal(36,10) | Y |
| 47 | WeighUnitKilogram | decimal(38,12) | Y |
| 48 | UniqueTaxID | nvarchar(255) | Y |
| 49 | IsStuffSerializable | bit | N |

### STF.VWStuffgroup

Definition: `programmability/views/STF.VWStuffgroup.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffGroupID | int | N |
| 2 | ParentID | int | Y |
| 3 | Title | nvarchar(256) | N |
| 4 | Title2 | nvarchar(256) | N |
| 5 | Code | nvarchar(256) | N |
| 6 | Version | int | N |
| 7 | Creator | int | N |
| 8 | CreationDate | datetime | N |
| 9 | LastEditor | int | N |
| 10 | LastEditionDate | datetime | N |
| 11 | Type | tinyint | Y |
| 12 | FullCode | nvarchar(200) | Y |

### STF.VWStuffPropertyValue

Definition: `programmability/views/STF.VWStuffPropertyValue.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffID | int | N |
| 2 | StandardTitle | nvarchar(MAX) | Y |
| 3 | StandardTitle2 | nvarchar(MAX) | Y |

### STF.vwStuffStock_ForPursuiteGroup

Definition: `programmability/views/STF.vwStuffStock_ForPursuiteGroup.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffID | int | N |
| 2 | StockID | int | Y |

