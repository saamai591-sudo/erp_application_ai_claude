# Schema `WMS`

## Tables

### WMS.Packing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PackingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StockID | int | N |  |  |
| 6 | PackingTypeID | int | N |  |  |
| 7 | PackingIdentity | nvarchar(100) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PackingID
- **FK** `FK_Packing_PackingType` (PackingTypeID) -> WMS.PackingType (PackingTypeID)
- **FK** `FK_Packing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Packing_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_Packing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Packing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** WMS.PackingItem (PackingID); WMS.PhysicalLocationItem (PackingID); WMS.WarehouseOutput (PackingID)

### WMS.PackingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PackingItemID | int | N |  | identity |
| 2 | PackingID | int | N |  |  |
| 3 | StockReceiptItemID | int | Y |  |  |
| 4 | ReturnedOutgoingItemID | int | Y |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PackingItemID
- **FK** `FK_PackingItem_Packing` (PackingID) -> WMS.Packing (PackingID) on delete CASCADE
- **FK** `FK_PackingItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_PackingItem_ReturnedOutgoingItem` (ReturnedOutgoingItemID) -> STC.ReturnedOutgoingItem (ReturnedOutgoingItemID)
- **FK** `FK_PackingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PackingItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### WMS.PackingType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PackingTypeID | int | N |  | identity |
| 2 | Code | nvarchar(25) | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | HasLimitedCapacity | bit | N |  |  |
| 6 | Length | decimal(10,2) | Y |  |  |
| 7 | Width | decimal(10,2) | Y |  |  |
| 8 | Height | decimal(10,2) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PackingTypeID
- **FK** `FK_PackingType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PackingType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** WMS.Packing (PackingTypeID)

### WMS.PhysicalLocation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PhysicalLocationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | Contents | tinyint | N |  |  |
| 7 | StockID | int | N |  |  |
| 8 | SourceWarehouseSpaceDesignID | int | Y |  |  |
| 9 | WarehouseSpaceDesignID | int | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PhysicalLocationID
- **FK** `FK_PhysicalLocation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PhysicalLocation_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_PhysicalLocation_SourceWarehouseSpaceDesign` (SourceWarehouseSpaceDesignID) -> WMS.WarehouseSpaceDesign (WarehouseSpaceDesignID)
- **FK** `FK_PhysicalLocation_WarehouseSpaceDesign` (WarehouseSpaceDesignID) -> WMS.WarehouseSpaceDesign (WarehouseSpaceDesignID)
- **FK** `FK_PhysicalLocation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PhysicalLocation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** WMS.PhysicalLocationItem (PhysicalLocationID)

### WMS.PhysicalLocationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PhysicalLocationItemID | int | N |  | identity |
| 2 | PhysicalLocationID | int | N |  |  |
| 3 | PackingID | int | Y |  |  |
| 4 | StockReceiptItemID | int | Y |  |  |
| 5 | ReturnedOutgoingItemID | int | Y |  |  |
| 6 | RelocationID | int | Y |  |  |
| 7 | MainQuantity | decimal(30,4) | Y |  |  |
| 8 | SubQuantity | decimal(30,4) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PhysicalLocationItemID
- **FK** `FK_PhysicalLocationItem_Packing` (PackingID) -> WMS.Packing (PackingID)
- **FK** `FK_PhysicalLocationItem_PhysicalLocation` (PhysicalLocationID) -> WMS.PhysicalLocation (PhysicalLocationID) on delete CASCADE
- **FK** `FK_PhysicalLocationItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_PhysicalLocationItem_ReturnedOutgoingItem` (ReturnedOutgoingItemID) -> STC.ReturnedOutgoingItem (ReturnedOutgoingItemID)
- **FK** `FK_PhysicalLocationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PhysicalLocationItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### WMS.WarehouseOutput

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WarehouseOutputID | int | N |  | identity |
| 2 | OutgoingItemID | int | Y |  |  |
| 3 | ReturnStockReceiptItemID | int | Y |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | WarehouseSpaceDesignID | int | Y |  |  |
| 12 | PackingID | int | Y |  |  |

- **Primary key:** WarehouseOutputID
- **FK** `FK_WarehouseOutput_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID) on delete CASCADE
- **FK** `FK_WarehouseOutput_ReturnStockReceiptItem` (ReturnStockReceiptItemID) -> STC.ReturnStockReceiptItem (ReturnStockReceiptItemID) on delete CASCADE
- **FK** `FK_WarehouseOutput_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WarehouseOutput_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_WarehouseOutput_WarehouseSpaceDesign` (WarehouseSpaceDesignID) -> WMS.WarehouseSpaceDesign (WarehouseSpaceDesignID)
- **FK** `FK_WarehouseOutput_Packing` (PackingID) -> WMS.Packing (PackingID)

### WMS.WarehouseSpaceDesign

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WarehouseSpaceDesignID | int | N |  | identity |
| 2 | StockID | int | Y |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | Code | nvarchar(25) | N |  |  |
| 5 | Title | nvarchar(250) | N |  |  |
| 6 | Title2 | nvarchar(250) | N |  |  |
| 7 | SmallestUnitDesigned | bit | N |  |  |
| 8 | HasLimitedCapacity | bit | N |  |  |
| 9 | Length | decimal(10,2) | Y |  |  |
| 10 | Width | decimal(10,2) | Y |  |  |
| 11 | Height | decimal(10,2) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |

- **Primary key:** WarehouseSpaceDesignID
- **FK** `FK_WarehouseSpaceDesign_Parent` (ParentID) -> WMS.WarehouseSpaceDesign (WarehouseSpaceDesignID)
- **FK** `FK_WarehouseSpaceDesign_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_WarehouseSpaceDesign_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WarehouseSpaceDesign_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** WMS.PhysicalLocation (SourceWarehouseSpaceDesignID); WMS.PhysicalLocation (WarehouseSpaceDesignID); WMS.WarehouseOutput (WarehouseSpaceDesignID); WMS.WarehouseSpaceDesign (ParentID)

### WMS.Warehousing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WarehousingID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | ZoneID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** WarehousingID
- **FK** `FK_Warehousing_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_Warehousing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Warehousing_LastEditor` (LastEditor) -> CFG.User (UserID)

### WMS.Zone

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ZoneID | int | N |  | identity |
| 2 | StockID | int | Y |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | Code | nvarchar(25) | N |  |  |
| 5 | Title | nvarchar(512) | N |  |  |
| 6 | Title2 | nvarchar(512) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | RootParentID | int | Y |  |  |

- **Primary key:** ZoneID
- **FK** `FK_Zone_ParentZone` (ParentID) -> WMS.Zone (ZoneID)
- **FK** `FK_Zone_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Zone_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_Zone_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Zone_RootParent` (RootParentID) -> WMS.Zone (ZoneID)
- **Referenced by:** STC.OutgoingItem (ZoneID); STC.RecountingInventoryItem (ZoneID); STC.RecountingInventoryTagItem (ZoneID); STC.ReturnStockReceiptItem (ZoneID); STC.StuffComposition (ZoneID); WMS.Zone (ParentID); WMS.Zone (RootParentID); WMS.ZoneInventory (ZoneID)

### WMS.ZoneInventory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ZoneInventoryID | int | N |  | identity |
| 2 | ZoneID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(36,10) | N |  |  |
| 5 | SubQuantity | decimal(36,10) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ZoneInventoryID
- **FK** `FK_ZoneInventory_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ZoneInventory_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ZoneInventory_Zone` (ZoneID) -> WMS.Zone (ZoneID)
- **FK** `FK_ZoneInventory_Creator` (Creator) -> CFG.User (UserID)

## Views

### WMS.vwWarehouseSummary

| # | Column | Type | Null |
|---|---|---|---|
| 1 | WarehouseSpaceDesignID | int | Y |
| 2 | Contents | int | N |
| 3 | PackingID | int | Y |
| 4 | StockReceiptItemID | int | Y |
| 5 | ReturnedOutgoingItemID | int | Y |
| 6 | OutgoingItemID | int | Y |
| 7 | ReturnStockReceiptItemID | int | Y |
| 8 | MainQuantity | decimal(32,4) | Y |
| 9 | SubQuantity | decimal(32,4) | Y |
| 10 | PackingIdentity | nvarchar(100) | Y |
| 11 | PhysicalLocationNumber | int | Y |
| 12 | PhysicalLocationDate | date | Y |
| 13 | InputOutputType | varchar(6) | N |

