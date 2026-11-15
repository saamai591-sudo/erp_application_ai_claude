# Schema `PRM`

## Tables

### PRM.BomGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BomGroupID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(50) | N |  |  |
| 5 | Title2 | nvarchar(50) | N |  |  |
| 6 | MeasureUnitID | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** BomGroupID
- **FK** `FK_BomGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BomGroup_MeasureUnit` (MeasureUnitID) -> STF.MeasureUnit (MeasureUnitID)
- **FK** `FK_BomGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionFormula (BomGroupID); PRM.ProductionFormulaItemMaterial (BomGroupID); PRM.StuffBomGroup (BomGroupID)

### PRM.CalculatedConversionCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculatedConversionCostID | int | N |  | identity |
| 2 | CostCalculationID | int | N |  |  |
| 3 | CalculatedWorkStationID | int | Y |  |  |
| 4 | StuffID | int | Y |  |  |
| 5 | VALUE | decimal(18,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculatedConversionCostID
- **FK** `FK_CalculatedConversionCost_CostCalculation` (CostCalculationID) -> PRM.CostCalculation (CostCalculationID) on delete CASCADE
- **FK** `FK_CalculatedConversionCost_CalculatedWorkStation` (CalculatedWorkStationID) -> PRM.CalculatedWorkStation (CalculatedWorkStationID)
- **FK** `FK_CalculatedConversionCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_CalculatedConversionCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculatedConversionCost_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.CalculatedMaterialCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculatedMaterialCostID | int | N |  | identity |
| 2 | CostCalculationID | int | N |  |  |
| 3 | StuffID | int | Y |  |  |
| 4 | MaterialID | int | Y |  |  |
| 5 | VALUE | decimal(18,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculatedMaterialCostID
- **FK** `FK_CalculatedMaterialCost_CostCalculation` (CostCalculationID) -> PRM.CostCalculation (CostCalculationID) on delete CASCADE
- **FK** `FK_CalculatedMaterialCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_CalculatedMaterialCost_MaterialStuff` (MaterialID) -> STF.Stuff (StuffID)
- **FK** `FK_CalculatedMaterialCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculatedMaterialCost_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.CalculatedWorkStation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculatedWorkStationID | int | N |  | identity |
| 2 | CostCalculationID | int | N |  |  |
| 3 | WorkStationID | int | Y |  |  |
| 4 | CostDataCollectionAccountSettingID | int | N |  |  |
| 5 | VALUE | decimal(18,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculatedWorkStationID
- **FK** `FK_CalculatedWorkStation_CostCalculation` (CostCalculationID) -> PRM.CostCalculation (CostCalculationID) on delete CASCADE
- **FK** `FK_CalculatedWorkStation_WorkStation` (WorkStationID) -> PRM.WorkStation (WorkStationID)
- **FK** `FK_CalculatedWorkStation_CostDataCollectionAccountSetting` (CostDataCollectionAccountSettingID) -> PRM.CostDataCollectionAccountSetting (CostDataCollectionAccountSettingID)
- **FK** `FK_CalculatedWorkStation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculatedWorkStation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CalculatedConversionCost (CalculatedWorkStationID)

### PRM.Consumption

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | ConsumptionRate | decimal(36,10) | Y |  |  |
| 7 | DeviationQuantity | decimal(36,10) | Y |  |  |
| 8 | DeviationCost | decimal(36,10) | Y |  |  |
| 9 | LoopNumber | tinyint | Y |  |  |
| 10 | StuffDetailType | tinyint | Y |  |  |


### PRM.Consumption_FirstWorkingInventory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | StuffDetailType | tinyint | Y |  |  |


### PRM.Consumption_LastWorkingInventory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | WorkingInventoryItemID | int | N |  |  |
| 3 | CostCenterId | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | Price | decimal(36,10) | Y |  |  |
| 6 | MainQuantity | decimal(36,10) | Y |  |  |
| 7 | StuffDetailType | tinyint | Y |  |  |


### PRM.Consumption_Outgoing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | StuffDetailType | tinyint | Y |  |  |


### PRM.Consumption_ProductionDelivery

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |


### PRM.Consumption_ReturnedOutgoing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |
| 6 | StuffDetailType | tinyint | Y |  |  |


### PRM.ConsumptionStatistic

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConsumptionStatisticID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | BaseType | tinyint | N |  |  |
| 6 | ProductionPlanningID | int | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | CostCenterId | int | N |  |  |

- **Primary key:** ConsumptionStatisticID
- **FK** `FK_ConsumptionStatistic_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ConsumptionStatistic_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ConsumptionStatistic_ProductionPlanning` (ProductionPlanningID) -> PRM.ProductionPlanning (ProductionPlanningID)
- **FK** `FK_ConsumptionStatistic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConsumptionStatistic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ConsumptionStatisticItem (ConsumptionStatisticID)

### PRM.ConsumptionStatisticItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConsumptionStatisticItemID | int | N |  | identity |
| 2 | ConsumptionStatisticID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(1000) | Y |  |  |
| 8 | Description2 | nvarchar(1000) | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** ConsumptionStatisticItemID
- **FK** `FK_ConsumptionStatisticItem_ConsumptionStatistic` (ConsumptionStatisticID) -> PRM.ConsumptionStatistic (ConsumptionStatisticID) on delete CASCADE
- **FK** `FK_ConsumptionStatisticItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ConsumptionStatisticItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConsumptionStatisticItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ConsumptionStatisticItemTrace (ConsumptionStatisticItemID)

### PRM.ConsumptionStatisticItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConsumptionStatisticItemTraceID | int | N |  | identity |
| 2 | ConsumptionStatisticItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ConsumptionStatisticItemTraceID
- **FK** `FK_ConsumptionStatisticItemTrace_ConsumptionStatisticItem` (ConsumptionStatisticItemID) -> PRM.ConsumptionStatisticItem (ConsumptionStatisticItemID) on delete CASCADE
- **FK** `FK_ConsumptionStatisticItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ConsumptionStatisticItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ConsumptionStatisticItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConsumptionStatisticItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConsumptionStatisticItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.CostCalculation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationID | int | N |  | identity |
| 2 | CostCalculationPeriodID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | VoucherID | int | Y |  |  |

- **Primary key:** CostCalculationID
- **FK** `FK_CostCalculation_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)
- **FK** `FK_CostCalculation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostCalculation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostCalculation_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete SET_NULL
- **Referenced by:** PRM.CalculatedConversionCost (CostCalculationID); PRM.CalculatedMaterialCost (CostCalculationID); PRM.CalculatedWorkStation (CostCalculationID); PRM.CostCollectedData (CostCalculationID)

### PRM.CostCalculationPeriod

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | StartDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostCalculationPeriodID
- **FK** `FK_CostCalculationPeriod_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_CostCalculationPeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostCalculationPeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CostCalculation (CostCalculationPeriodID); PRM.CostDataCollectionSetting (CostCalculationPeriodID); PRM.CostDriverPeriodData (CostCalculationPeriodID); PRM.CostStructureAccount (CostCalculationPeriodID); PRM.PeriodProductionBOM (CostCalculationPeriodID); PRM.WorkingInventory (CostCalculationPeriodID)

### PRM.CostCollectedData

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCollectedDataID | int | N |  | identity |
| 2 | CostCalculationID | int | N |  |  |
| 3 | CostDataCollectionAccountSettingID | int | N |  |  |
| 4 | Value | decimal(18,0) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostCollectedDataID
- **FK** `FK_CostCollectedData_CostCalculation` (CostCalculationID) -> PRM.CostCalculation (CostCalculationID) on delete CASCADE
- **FK** `FK_CostCollectedData_CostDataCollectionAccountSetting` (CostDataCollectionAccountSettingID) -> PRM.CostDataCollectionAccountSetting (CostDataCollectionAccountSettingID)
- **FK** `FK_CostCollectedData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostCollectedData_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.CostDataCollectionAccountSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostDataCollectionAccountSettingID | int | N |  | identity |
| 2 | CostDataCollectionSettingID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | CostBehaviour | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | SlID | int | Y |  |  |
| 11 | CostDriverID | int | N | ((-1)) |  |

- **Primary key:** CostDataCollectionAccountSettingID
- **FK** `FK_CostDataCollectionAccountSetting_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CostDataCollectionAccountSetting_CostDataCollectionSetting` (CostDataCollectionSettingID) -> PRM.CostDataCollectionSetting (CostDataCollectionSettingID) on delete CASCADE
- **FK** `FK_CostDataCollectionAccountSetting_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostDataCollectionAccountSetting_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostDataCollectionAccountSetting_CostDriver` (CostDriverID) -> PRM.CostDriver (CostDriverID)
- **Referenced by:** PRM.CalculatedWorkStation (CostDataCollectionAccountSettingID); PRM.CostCollectedData (CostDataCollectionAccountSettingID)

### PRM.CostDataCollectionSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostDataCollectionSettingID | int | N |  | identity |
| 2 | Version | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | CostCalculationPeriodID | int | Y |  |  |
| 8 | CostStructureID | int | Y |  |  |

- **Primary key:** CostDataCollectionSettingID
- **FK** `FK_CostDataCollectionSetting_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)
- **FK** `FK_CostDataCollectionSetting_CostStructure` (CostStructureID) -> PRM.CostStructure (CostStructureID)
- **FK** `FK_CostDataCollectionSetting_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostDataCollectionSetting_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CostDataCollectionAccountSetting (CostDataCollectionSettingID)

### PRM.CostDriver

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostDriverID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | CostDriverType | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostDriverID
- **FK** `FK_CostDriver_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostDriver_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CostDataCollectionAccountSetting (CostDriverID); PRM.CostDriverPeriodData (CostDriverID); PRM.ProductionTiming (CostDriverID)

### PRM.CostDriverPeriodData

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostDriverPeriodDataID | int | N |  | identity |
| 2 | CostDriverID | int | N |  |  |
| 3 | CostCalculationPeriodID | int | N |  |  |
| 4 | RowIndex | smallint | N |  |  |
| 5 | WorkStationID | int | Y |  |  |
| 6 | StuffID | int | Y |  |  |
| 7 | Value | decimal(18,0) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostDriverPeriodDataID
- **unique constraint** `UC_CostDriverPeriodData_CostDriver_CostCalculationPeriod_WorkStation_Stuff` (CostDriverID, CostCalculationPeriodID, WorkStationID, StuffID)
- **FK** `FK_CostDriverPeriodData_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)
- **FK** `FK_CostDriverPeriodData_CostDriver` (CostDriverID) -> PRM.CostDriver (CostDriverID)
- **FK** `FK_CostDriverPeriodData_WorkStation` (WorkStationID) -> PRM.WorkStation (WorkStationID)
- **FK** `FK_CostDriverPeriodData_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_CostDriverPeriodData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostDriverPeriodData_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.CostStructure

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostStructureID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | Title | nvarchar(250) | N |  |  |
| 5 | Title2 | nvarchar(250) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Type | tinyint | Y |  |  |

- **Primary key:** CostStructureID
- **FK** `FK_CostStructure_Parent` (ParentID) -> PRM.CostStructure (CostStructureID)
- **FK** `FK_CostStructure_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostStructure_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CostDataCollectionSetting (CostStructureID); PRM.CostStructure (ParentID); PRM.CostStructureAccount (CostStructureID); PRM.ProductionFormulaItemMaterial (CostStructureID)

### PRM.CostStructureAccount

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostStructureAccountID | int | N |  | identity |
| 2 | CostStructureID | int | N |  |  |
| 3 | CostCalculationPeriodID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostStructureAccountID
- **FK** `FK_CostStructureAccount_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)
- **FK** `FK_CostStructureAccount_CostStructure` (CostStructureID) -> PRM.CostStructure (CostStructureID) on delete CASCADE
- **FK** `FK_CostStructureAccount_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostStructureAccount_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CostStructureAccountItem (CostStructureAccountID)

### PRM.CostStructureAccountItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostStructureAccountItemID | int | N |  | identity |
| 2 | CostStructureAccountID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | SlID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | ApportionBaseType | tinyint | Y |  |  |

- **Primary key:** CostStructureAccountItemID
- **FK** `FK_CostStructureAccountItem_CostStructureAccount` (CostStructureAccountID) -> PRM.CostStructureAccount (CostStructureAccountID) on delete CASCADE
- **FK** `FK_CostStructureAccountItem_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CostStructureAccountItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostStructureAccountItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.ErrorReport

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Message | nvarchar(MAX) | Y |  |  |


### PRM.Machinery

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MachineryID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(500) | N |  |  |
| 4 | Title2 | nvarchar(500) | N |  |  |
| 5 | Location | nvarchar(500) | N |  |  |
| 6 | Location2 | nvarchar(500) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** MachineryID
- **FK** `FK_Machinery_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Machinery_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.RepairPlanning (MachineryID)

### PRM.MaterialPlanningSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MaterialPlanningSettingID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | StockReceiptTime | smallint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** MaterialPlanningSettingID
- **unique constraint** `UC_MaterialPlanningSetting_StuffID` (StuffID)
- **FK** `FK_MaterialPlanningSetting_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_MaterialPlanningSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MaterialPlanningSetting_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.OtherCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | CostStructureID | int | N |  |  |
| 4 | SlID | int | N |  |  |
| 5 | ApportionBaseType | tinyint | N |  |  |
| 6 | Cost | decimal(36,10) | Y |  |  |


### PRM.PeriodProduction

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PeriodProductionID | int | N |  | identity |
| 2 | CostCalculationPeriodID | int | N |  |  |
| 3 | CostCenterId | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | Quantity | decimal(36,10) | Y |  |  |
| 6 | Fee | decimal(36,10) | Y |  |  |
| 7 | ProductionFormulaItemID | int | Y |  |  |

- **Primary key:** PeriodProductionID
- **FK** `FK_PeriodProduction_ProductionFormulaItem` (ProductionFormulaItemID) -> PRM.ProductionFormulaItem (ProductionFormulaItemID)

### PRM.PeriodProductionBOM

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PeriodProductionBOMID | int | N |  | identity |
| 2 | CostCalculationPeriodID | int | N |  |  |
| 3 | PeriodProductionID | int | N |  |  |
| 4 | CostCenterId | int | N |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | StuffDetailType | tinyint | N |  |  |
| 7 | Quantity | decimal(36,10) | Y |  |  |
| 8 | StandardCost | decimal(36,10) | Y |  |  |
| 9 | DeviationShare | decimal(36,10) | Y |  |  |
| 10 | Cost | decimal(37,10) | Y |  | computed: ([StandardCost]-[DeviationShare]) |

- **Primary key:** PeriodProductionBOMID
- **FK** `FK_PeriodProductionBOM_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)

### PRM.PeriodProductionOtherCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PeriodProductionOtherCostID | int | N |  | identity |
| 2 | CostCalculationPeriodID | int | N |  |  |
| 3 | PeriodProductionID | int | N |  |  |
| 4 | CostStructureID | int | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | ShareOfCost | decimal(36,10) | Y |  |  |


### PRM.PlanningItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PlanningItemID | int | N |  | identity |
| 2 | ProductionAnalysisID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | CostCenterId | int | N |  |  |

- **Primary key:** PlanningItemID
- **FK** `FK_PlanningItem_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_PlanningItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PlanningItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PlanningItem_ProductionAnalysis` (ProductionAnalysisID) -> PRM.ProductionAnalysis (ProductionAnalysisID) on delete CASCADE, on update CASCADE
- **FK** `FK_PlanningItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.PlanningItemTrace (PlanningItemID); PRM.ProductionPlanningItem (PlanningItemID)

### PRM.PlanningItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PlanningItemTraceID | int | N |  | identity |
| 2 | PlanningItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** PlanningItemTraceID
- **FK** `FK_PlanningItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PlanningItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PlanningItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PlanningItemTrace_PlanningItem` (PlanningItemID) -> PRM.PlanningItem (PlanningItemID) on delete CASCADE, on update CASCADE
- **FK** `FK_PlanningItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_PlanningItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.Production_FirstWorkingInventory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCalculationPeriodID | int | N |  |  |
| 2 | CostCenterId | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Price | decimal(36,10) | Y |  |  |
| 5 | MainQuantity | decimal(36,10) | Y |  |  |


### PRM.ProductionAnalysis

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionAnalysisID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ProductionAnalysisID
- **FK** `FK_ProductionAnalysis_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionAnalysis_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProductionAnalysis_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.PlanningItem (ProductionAnalysisID); PRM.ProductionAnalysisItem (ProductionAnalysisID); PRM.RequiredMaterial (ProductionAnalysisID); PRM.RequiredProduct (ProductionAnalysisID)

### PRM.ProductionAnalysisItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionAnalysisItemID | int | N |  | identity |
| 2 | ProductionAnalysisID | int | N |  |  |
| 3 | BaseType | tinyint | N |  |  |
| 4 | BaseID | int | Y |  |  |
| 5 | RowIndex | smallint | N |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(30,4) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | ProductionFormulaItemID | int | Y |  |  |
| 14 | CostCenterId | int | Y |  |  |

- **Primary key:** ProductionAnalysisItemID
- **FK** `FK_ProductionAnalysisItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionAnalysisItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionAnalysisItem_ProductionAnalysis` (ProductionAnalysisID) -> PRM.ProductionAnalysis (ProductionAnalysisID) on delete CASCADE, on update CASCADE
- **FK** `FK_ProductionAnalysisItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionAnalysisItem_ProductionFormulaItem` (ProductionFormulaItemID) -> PRM.ProductionFormulaItem (ProductionFormulaItemID)
- **FK** `FK_ProductionAnalysisItem_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **Referenced by:** PRM.ProductionAnalysisItemTrace (ProductionAnalysisItemID)

### PRM.ProductionAnalysisItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionAnalysisItemTraceID | int | N |  | identity |
| 2 | ProductionAnalysisItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionAnalysisItemTraceID
- **FK** `FK_ProductionAnalysisItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionAnalysisItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionAnalysisItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionAnalysisItemTrace_ProductionAnalysisItem` (ProductionAnalysisItemID) -> PRM.ProductionAnalysisItem (ProductionAnalysisItemID) on delete CASCADE, on update CASCADE
- **FK** `FK_ProductionAnalysisItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionAnalysisItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionDelivery

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionDeliveryID | int | N |  | identity |
| 2 | BaseType | tinyint | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CostCenterId | int | N |  |  |
| 11 | DeliverCostCenterId | int | N |  |  |

- **Primary key:** ProductionDeliveryID
- **FK** `FK_ProductionDelivery_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ProductionDelivery_DeliverCostCenter` (DeliverCostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ProductionDelivery_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionDelivery_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionDeliveryItem (ProductionDeliveryID)

### PRM.ProductionDeliveryItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionDeliveryItemID | int | N |  | identity |
| 2 | ProductionDeliveryID | int | Y |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(1000) | Y |  |  |
| 8 | Description2 | nvarchar(1000) | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | ProductionPlanningItemID | int | Y |  |  |
| 15 | ProductionStatisticItemID | int | Y |  |  |
| 16 | Price | decimal(36,10) | Y |  |  |

- **Primary key:** ProductionDeliveryItemID
- **FK** `FK_ProductionDeliveryItem_ProductionDelivery` (ProductionDeliveryID) -> PRM.ProductionDelivery (ProductionDeliveryID) on delete CASCADE
- **FK** `FK_ProductionDeliveryItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionDeliveryItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionDeliveryItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionDeliveryItem_ProductionPlanningItem` (ProductionPlanningItemID) -> PRM.ProductionPlanningItem (ProductionPlanningItemID)
- **Referenced by:** PRM.ProductionDeliveryItemTrace (ProductionDeliveryItemID)

### PRM.ProductionDeliveryItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionDeliveryItemTraceID | int | N |  | identity |
| 2 | ProductionDeliveryItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionDeliveryItemTraceID
- **FK** `FK_ProductionDeliveryItemTrace_ProductionDeliveryItem` (ProductionDeliveryItemID) -> PRM.ProductionDeliveryItem (ProductionDeliveryItemID) on delete CASCADE
- **FK** `FK_ProductionDeliveryItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionDeliveryItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionDeliveryItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionDeliveryItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionDeliveryItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionFormula

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionFormulaID | int | N |  | identity |
| 2 | StuffID | int | Y |  |  |
| 3 | Quantity | decimal(30,4) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Type | tinyint | N | ((1)) |  |
| 10 | BomGroupID | int | Y |  |  |

- **Primary key:** ProductionFormulaID
- **FK** `FK_ProductionFormula_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionFormula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionFormula_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionFormula_BomGroup` (BomGroupID) -> PRM.BomGroup (BomGroupID)
- **Referenced by:** PRM.ProductionFormulaItem (ProductionFormulaID); PRM.ProductionFormulaTrace (ProductionFormulaID)

### PRM.ProductionFormulaItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionFormulaItemID | int | N |  | identity |
| 2 | ProductionFormulaID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Title | nvarchar(250) | N |  |  |
| 5 | Title2 | nvarchar(250) | N |  |  |
| 6 | EffectiveDate | date | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | IsMain | bit | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** ProductionFormulaItemID
- **FK** `FK_ProductionFormulaItem_ProductionFormula` (ProductionFormulaID) -> PRM.ProductionFormula (ProductionFormulaID) on delete CASCADE
- **FK** `FK_ProductionFormulaItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionFormulaItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.PeriodProduction (ProductionFormulaItemID); PRM.ProductionAnalysisItem (ProductionFormulaItemID); PRM.ProductionFormulaItemMaterial (ProductionFormulaItemID); PRM.ProductionStatisticItem (ProductionFormulaItemID)

### PRM.ProductionFormulaItemMaterial

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionFormulaItemMaterialID | int | N |  | identity |
| 2 | ProductionFormulaItemID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StuffID | int | Y |  |  |
| 5 | Quantity | decimal(36,10) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | CostStructureID | int | Y |  |  |
| 12 | NeedAnalysis | bit | N | ((0)) |  |
| 13 | BomGroupID | int | Y |  |  |
| 14 | Type | tinyint | N | ((1)) |  |
| 15 | CompletionPercentage | tinyint | N | ((0)) |  |

- **Primary key:** ProductionFormulaItemMaterialID
- **FK** `FK_ProductionFormulaItemMaterial_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionFormulaItemMaterial_BomGroup` (BomGroupID) -> PRM.BomGroup (BomGroupID)
- **FK** `FK_ProductionFormulaItemMaterial_CostStructure` (CostStructureID) -> PRM.CostStructure (CostStructureID)
- **FK** `FK_ProductionFormulaItemMaterial_ProductionFormulaItem` (ProductionFormulaItemID) -> PRM.ProductionFormulaItem (ProductionFormulaItemID) on delete CASCADE
- **FK** `FK_ProductionFormulaItemMaterial_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionFormulaItemMaterial_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionFormulaItemMaterialTrace (ProductionFormulaItemMaterialID)

### PRM.ProductionFormulaItemMaterialTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionFormulaItemMaterialTraceID | int | N |  | identity |
| 2 | ProductionFormulaItemMaterialID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionFormulaItemMaterialTraceID
- **FK** `FK_ProductionFormulaItemMaterialTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_ProductionFormulaItemMaterialTrace_ProductionFormulaItemMaterial` (ProductionFormulaItemMaterialID) -> PRM.ProductionFormulaItemMaterial (ProductionFormulaItemMaterialID) on delete CASCADE
- **FK** `FK_ProductionFormulaItemMaterialTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionFormulaItemMaterialTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionFormulaItemMaterialTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionFormulaItemMaterialTrace_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.ProductionFormulaTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionFormulaTraceID | int | N |  | identity |
| 2 | ProductionFormulaID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionFormulaTraceID
- **FK** `FK_ProductionFormulaTrace_ProductionFormula` (ProductionFormulaID) -> PRM.ProductionFormula (ProductionFormulaID) on delete CASCADE
- **FK** `FK_ProductionFormulaTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionFormulaTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionFormulaTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionFormulaTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionFormulaTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionManagementSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionManagementSettingID | int | N |  | identity |
| 2 | ConfigKey | varchar(50) | N |  |  |
| 3 | ConfigValue | nvarchar(500) | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ProductionManagementSettingID
- **FK** `FK_ProductionManagementSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionManagementSetting_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.ProductionOrder

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionOrderID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Status | tinyint | N | ((1)) |  |

- **Primary key:** ProductionOrderID
- **FK** `FK_ProductionOrder_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProductionOrder_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionOrder_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionOrderItem (ProductionOrderID)

### PRM.ProductionOrderItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionOrderItemID | int | N |  | identity |
| 2 | ProductionOrderID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BaseType | tinyint | N |  |  |
| 5 | QuotationItemID | int | Y |  |  |
| 6 | SaleContractItemID | int | Y |  |  |
| 7 | StuffID | int | N |  |  |
| 8 | MainQuantity | decimal(30,4) | N |  |  |
| 9 | SubQuantity | decimal(30,4) | Y |  |  |
| 10 | DeliveryDate | datetime | N |  |  |
| 11 | Description | nvarchar(512) | Y |  |  |
| 12 | Description2 | nvarchar(512) | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |

- **Primary key:** ProductionOrderItemID
- **FK** `FK_ProductionOrderItem_ProductionOrder` (ProductionOrderID) -> PRM.ProductionOrder (ProductionOrderID) on delete CASCADE
- **FK** `FK_ProductionOrderItem_QuotationItem` (QuotationItemID) -> SLE.QuotationItem (QuotationItemID)
- **FK** `FK_ProductionOrderItem_SaleContractItem` (SaleContractItemID) -> SLE.SaleContractItem (SaleContractItemID)
- **FK** `FK_ProductionOrderItem_stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionOrderItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionOrderItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionOrderItemTrace (ProductionOrderItemID); PRM.ProductionPlanningItem (ProductionOrderItemID)

### PRM.ProductionOrderItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionOrderItemTraceID | int | N |  | identity |
| 2 | ProductionOrderItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionOrderItemTraceID
- **FK** `FK_ProductionOrderItemTrace_ProductionOrderItem` (ProductionOrderItemID) -> PRM.ProductionOrderItem (ProductionOrderItemID) on delete CASCADE
- **FK** `FK_ProductionOrderItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionOrderItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionOrderItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionOrderItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionOrderItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionPlanning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPlanningID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StartDate | datetime | Y |  |  |
| 6 | EndDate | datetime | Y |  |  |
| 7 | ProductionProcessID | int | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | State | tinyint | N |  |  |

- **Primary key:** ProductionPlanningID
- **FK** `FK_ProductionPlanning_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProductionPlanning_ProductionProcess` (ProductionProcessID) -> PRM.ProductionProcess (ProductionProcessID)
- **FK** `FK_ProductionPlanning_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPlanning_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ConsumptionStatistic (ProductionPlanningID); PRM.ProductionPlanningItem (ProductionPlanningID); PRM.StationPerformance (ProductionPlanningID)

### PRM.ProductionPlanningItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPlanningItemID | int | N |  | identity |
| 2 | ProductionPlanningID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BaseType | tinyint | N |  |  |
| 5 | ProductionOrderItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(30,4) | N |  |  |
| 8 | SubQuantity | decimal(30,4) | Y |  |  |
| 9 | Description | nvarchar(512) | Y |  |  |
| 10 | Description2 | nvarchar(512) | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | PlanningItemID | int | Y |  |  |
| 17 | CostCenterId | int | N |  |  |
| 18 | WorkStationID | int | Y |  |  |

- **Primary key:** ProductionPlanningItemID
- **FK** `FK_ProductionPlanningItem_ProductionOrderItem` (ProductionOrderItemID) -> PRM.ProductionOrderItem (ProductionOrderItemID)
- **FK** `FK_ProductionPlanningItem_ProductionPlanning` (ProductionPlanningID) -> PRM.ProductionPlanning (ProductionPlanningID) on delete CASCADE
- **FK** `FK_ProductionPlanningItem_stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionPlanningItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPlanningItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionPlanningItem_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ProductionPlanningItem_PlanningItem` (PlanningItemID) -> PRM.PlanningItem (PlanningItemID)
- **Referenced by:** PRM.ProductionDeliveryItem (ProductionPlanningItemID); PRM.ProductionPlanningItemTrace (ProductionPlanningItemID); PRM.ProductionStatisticItem (ProductionPlanningItemID); STC.StockReceiptItem (ProductionPlanningItemID)

### PRM.ProductionPlanningItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionPlanningItemTraceID | int | N |  | identity |
| 2 | ProductionPlanningItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionPlanningItemTraceID
- **FK** `FK_ProductionPlanningItemTrace_ProductionPlanningItem` (ProductionPlanningItemID) -> PRM.ProductionPlanningItem (ProductionPlanningItemID) on delete CASCADE
- **FK** `FK_ProductionPlanningItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionPlanningItemTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionPlanningItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionPlanningItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionPlanningItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionProcess

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionProcessID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ProductionProcessID
- **unique constraint** `UC_ProductionProcess_Code` (Code)
- **unique constraint** `UC_ProductionProcess_Title` (Title)
- **unique constraint** `UC_ProductionProcess_Title2` (Title2)
- **FK** `FK_ProductionProcess_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionProcess_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionPlanning (ProductionProcessID); PRM.ProductionProcessItem (ProductionProcessID); PRM.ProductionStopItem (ProductionProcessID); PRM.WorkSchedule (ProductionProcessID)

### PRM.ProductionProcessItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionProcessItemID | int | N |  | identity |
| 2 | ProductionProcessID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | WorkStationID | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ProductionProcessItemID
- **FK** `FK_ProductionProcessItem_ProductionProcess` (ProductionProcessID) -> PRM.ProductionProcess (ProductionProcessID) on delete CASCADE
- **FK** `FK_ProductionProcessItem_WorkStation` (WorkStationID) -> PRM.WorkStation (WorkStationID)
- **FK** `FK_ProductionProcessItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionProcessItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.ProductionStatistic

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStatisticID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | BaseType | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | CostCenterId | int | N |  |  |
| 12 | Status | tinyint | N | ((1)) |  |
| 13 | OutgoingID | int | Y |  |  |

- **Primary key:** ProductionStatisticID
- **FK** `FK_ProductionStatistic_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ProductionStatistic_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete SET_NULL
- **FK** `FK_ProductionStatistic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStatistic_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProductionStatistic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionStatisticItem (ProductionStatisticID)

### PRM.ProductionStatisticItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStatisticItemID | int | N |  | identity |
| 2 | ProductionStatisticID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Description | nvarchar(1000) | Y |  |  |
| 7 | Description2 | nvarchar(1000) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | ProductionPlanningItemID | int | Y |  |  |
| 14 | ProductionFormulaItemID | int | Y |  |  |

- **Primary key:** ProductionStatisticItemID
- **FK** `FK_ProductionStatisticItem_ProductionPlanningItem` (ProductionPlanningItemID) -> PRM.ProductionPlanningItem (ProductionPlanningItemID)
- **FK** `FK_ProductionStatisticItem_ProductionFormulaItem` (ProductionFormulaItemID) -> PRM.ProductionFormulaItem (ProductionFormulaItemID)
- **FK** `FK_ProductionStatisticItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStatisticItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionStatisticItem_ProductionStatistic` (ProductionStatisticID) -> PRM.ProductionStatistic (ProductionStatisticID) on delete CASCADE
- **FK** `FK_ProductionStatisticItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.ProductionStatisticItemTrace (ProductionStatisticItemID); STC.StockReceiptItem (ProductionStatisticItemID)

### PRM.ProductionStatisticItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStatisticItemTraceID | int | N |  | identity |
| 2 | ProductionStatisticItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionStatisticItemTraceID
- **FK** `FK_ProductionStatisticItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStatisticItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionStatisticItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionStatisticItemTrace_ProductionStatisticItem` (ProductionStatisticItemID) -> PRM.ProductionStatisticItem (ProductionStatisticItemID) on delete CASCADE
- **FK** `FK_ProductionStatisticItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionStatisticItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.ProductionStop

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStopID | int | N |  | identity |
| 2 | FromDate | date | N |  |  |
| 3 | StartHour | decimal(18,0) | N |  |  |
| 4 | ToDate | date | N |  |  |
| 5 | EndHour | decimal(18,0) | N |  |  |
| 6 | ProductionStopReasonID | int | N |  |  |
| 7 | StopType | tinyint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ProductionStopID
- **FK** `FK_ProductionStop_ProductionStopReason` (ProductionStopReasonID) -> PRM.ProductionStopReason (ProductionStopReasonID)
- **FK** `FK_ProductionStop_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStop_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionStopItem (ProductionStopID)

### PRM.ProductionStopItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStopItemID | int | N |  | identity |
| 2 | ProductionStopID | int | N |  |  |
| 3 | ProductionProcessID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ProductionStopItemID
- **FK** `FK_ProductionStopItem_ProductionProcess` (ProductionProcessID) -> PRM.ProductionProcess (ProductionProcessID)
- **FK** `FK_ProductionStopItem_ProductionStop` (ProductionStopID) -> PRM.ProductionStop (ProductionStopID) on delete CASCADE
- **FK** `FK_ProductionStopItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStopItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.ProductionStopReason

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionStopReasonID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ProductionStopReasonID
- **FK** `FK_ProductionStopReason_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionStopReason_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ProductionStop (ProductionStopReasonID)

### PRM.ProductionTiming

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionTimingID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | ProductionTime | decimal(18,0) | N |  |  |
| 4 | Quantity | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CostCenterId | int | N |  |  |
| 11 | CostDriverID | int | N | ((-1)) |  |

- **Primary key:** ProductionTimingID
- **FK** `FK_ProductionTiming_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_ProductionTiming_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionTiming_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionTiming_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProductionTiming_CostDriverID` (CostDriverID) -> PRM.CostDriver (CostDriverID)
- **Referenced by:** PRM.ProductionTimingTrace (ProductionTimingID)

### PRM.ProductionTimingTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProductionTimingTraceID | int | N |  | identity |
| 2 | ProductionTimingID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ProductionTimingTraceID
- **FK** `FK_ProductionTimingTrace_ProductionTiming` (ProductionTimingID) -> PRM.ProductionTiming (ProductionTimingID) on delete CASCADE
- **FK** `FK_ProductionTimingTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ProductionTimingTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ProductionTimingTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProductionTimingTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProductionTimingTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.QualityControl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | QualityControlID | int | N |  | identity |
| 2 | ProductionStatisticID | int | N |  |  |
| 3 | ReviewedQuantity | decimal(30,4) | N |  |  |
| 4 | QualityParameterID | int | N |  |  |
| 5 | ParameterValue | decimal(30,4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** QualityControlID
- **FK** `FK_QualityControl_QualityParameter` (QualityParameterID) -> PRM.QualityParameter (QualityParameterID)
- **FK** `FK_QualityControl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_QualityControl_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.QualityParameter

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | QualityParameterID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | AcceptableQuantity | decimal(30,4) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** QualityParameterID
- **FK** `FK_QualityParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_QualityParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.QualityControl (QualityParameterID); PRM.QualityParameterItem (QualityParameterID)

### PRM.QualityParameterItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | QualityParameterItemID | int | N |  | identity |
| 2 | QualityParameterID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Quantity | decimal(30,4) | N |  |  |
| 5 | Passed | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** QualityParameterItemID
- **FK** `FK_QualityParameterItem_QualityParameter` (QualityParameterID) -> PRM.QualityParameter (QualityParameterID) on delete CASCADE
- **FK** `FK_QualityParameterItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_QualityParameterItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.RepairPlanning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairPlanningID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | MachineryID | int | N |  |  |
| 4 | ForecastDate | date | N |  |  |
| 5 | RepairTime | time(7) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** RepairPlanningID
- **FK** `FK_RepairPlanning_Machinery` (MachineryID) -> PRM.Machinery (MachineryID)
- **FK** `FK_RepairPlanning_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairPlanning_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.RepairReport (RepairPlanningID); PRM.RepairRequirement (RepairPlanningID)

### PRM.RepairReport

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairReportID | int | N |  | identity |
| 2 | RepairPlanningID | int | N |  |  |
| 3 | RepairFinishDate | date | N |  |  |
| 4 | RepairTime | time(7) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** RepairReportID
- **FK** `FK_RepairReport_RepairPlanning` (RepairPlanningID) -> PRM.RepairPlanning (RepairPlanningID)
- **FK** `FK_RepairReport_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairReport_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.RepairReportService (RepairReportID); PRM.RepairReportStuff (RepairReportID)

### PRM.RepairReportService

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairReportServiceID | int | N |  | identity |
| 2 | RepairReportID | int | N |  |  |
| 3 | ExpertiseUsedTitle | nvarchar(500) | N |  |  |
| 4 | FunctionValue | time(7) | N |  |  |
| 5 | Price | decimal(30,4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** RepairReportServiceID
- **FK** `FK_RepairReportService_RepairReport` (RepairReportID) -> PRM.RepairReport (RepairReportID) on delete CASCADE
- **FK** `FK_RepairReportService_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairReportService_EditorUser` (LastEditor) -> CFG.User (UserID)

### PRM.RepairReportStuff

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairReportStuffID | int | N |  | identity |
| 2 | RepairReportID | int | N |  |  |
| 3 | RepairRequirementItemID | int | N |  |  |
| 4 | Quantity | int | N |  |  |
| 5 | Price | decimal(30,4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** RepairReportStuffID
- **FK** `FK_RepairReportStuff_RepairReport` (RepairReportID) -> PRM.RepairReport (RepairReportID) on delete CASCADE
- **FK** `FK_RepairReportStuff_RepairRequirementItem` (RepairRequirementItemID) -> PRM.RepairRequirementItem (RepairRequirementItemID)
- **FK** `FK_RepairReportStuff_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairReportStuff_EditorUser` (LastEditor) -> CFG.User (UserID)

### PRM.RepairRequirement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairRequirementID | int | N |  | identity |
| 2 | RepairPlanningID | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |

- **Primary key:** RepairRequirementID
- **FK** `FK_RepairRequirement_RepairPlanning` (RepairPlanningID) -> PRM.RepairPlanning (RepairPlanningID)
- **FK** `FK_RepairRequirement_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairRequirement_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.RepairRequirementItem (RepairRequirementID)

### PRM.RepairRequirementItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairRequirementItemID | int | N |  | identity |
| 2 | RepairRequirementID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Quantity | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** RepairRequirementItemID
- **FK** `FK_RepairRequirementItem_RepairRequirement` (RepairRequirementID) -> PRM.RepairRequirement (RepairRequirementID) on delete CASCADE
- **FK** `FK_RepairRequirementItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_RepairRequirementItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairRequirementItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.RepairReportStuff (RepairRequirementItemID)

### PRM.RequiredMaterial

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequiredMaterialID | int | N |  | identity |
| 2 | ProductionAnalysisID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | RequiredQuantity | decimal(30,4) | N |  |  |
| 6 | DefiniteInventory | decimal(30,4) | N |  |  |
| 7 | IndefiniteInventory | decimal(30,4) | N |  |  |
| 8 | Shortage | decimal(18,0) | N |  |  |
| 9 | Adjustment | decimal(30,4) | N |  |  |
| 10 | ProductionOrder | decimal(30,4) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Reserved | decimal(30,4) | N |  |  |
| 17 | CostCenterId | int | Y |  |  |

- **Primary key:** RequiredMaterialID
- **FK** `FK_RequiredMaterial_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterial_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterial_ProductionAnalysisID` (ProductionAnalysisID) -> PRM.ProductionAnalysis (ProductionAnalysisID) on delete CASCADE, on update CASCADE
- **FK** `FK_RequiredMaterial_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.RequiredMaterialCostCenter (RequiredMaterialID); PRM.RequiredMaterialTrace (RequiredMaterialID); REQ.StuffRequestItem (RequiredMaterialID)

### PRM.RequiredMaterialCostCenter

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequiredMaterialCostCenterID | int | N |  | identity |
| 2 | RequiredMaterialID | int | N |  |  |
| 3 | CostCenterID | int | N |  |  |
| 4 | RequiredQuantity | decimal(36,10) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RequiredMaterialCostCenterID
- **FK** `FK_RequiredMaterialCostCenter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterialCostCenter_CostCenter` (CostCenterID) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_RequiredMaterialCostCenter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterialCostCenter_RequiredMaterial` (RequiredMaterialID) -> PRM.RequiredMaterial (RequiredMaterialID) on delete CASCADE, on update CASCADE

### PRM.RequiredMaterialTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequiredMaterialTraceID | int | N |  | identity |
| 2 | RequiredMaterialID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** RequiredMaterialTraceID
- **FK** `FK_RequiredMaterialTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterialTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_RequiredMaterialTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RequiredMaterialTrace_RequiredMaterial` (RequiredMaterialID) -> PRM.RequiredMaterial (RequiredMaterialID) on delete CASCADE, on update CASCADE
- **FK** `FK_RequiredMaterialTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_RequiredMaterialTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.RequiredProduct

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequiredProductID | int | N |  | identity |
| 2 | ProductionAnalysisID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | RequiredQuantity | decimal(30,4) | N |  |  |
| 6 | DefiniteInventory | decimal(30,4) | N |  |  |
| 7 | IndefiniteInventory | decimal(30,4) | N |  |  |
| 8 | Shortage | decimal(18,0) | N |  |  |
| 9 | Adjustment | decimal(30,4) | N |  |  |
| 10 | ProductionOrder | decimal(30,4) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Planned | decimal(30,4) | N |  |  |
| 17 | Reserved | decimal(30,4) | N |  |  |
| 18 | CostCenterId | int | Y |  |  |

- **Primary key:** RequiredProductID
- **FK** `FK_RequiredProduct_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequiredProduct_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RequiredProduct_ProductionAnalysisID` (ProductionAnalysisID) -> PRM.ProductionAnalysis (ProductionAnalysisID) on delete CASCADE, on update CASCADE
- **FK** `FK_RequiredProduct_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.RequiredProductTrace (RequiredProductID)

### PRM.RequiredProductTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequiredProductTraceID | int | N |  | identity |
| 2 | RequiredProductID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** RequiredProductTraceID
- **FK** `FK_RequiredProductTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequiredProductTrace_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_RequiredProductTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RequiredProductTrace_RequiredProduct` (RequiredProductID) -> PRM.RequiredProduct (RequiredProductID) on delete CASCADE, on update CASCADE
- **FK** `FK_RequiredProductTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_RequiredProductTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.Rework

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReworkID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | CostCenterId | int | N |  |  |
| 6 | DeliverToCostCenterId | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** ReworkID
- **FK** `FK_Rework_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_Rework_DeliverToCostCenter` (DeliverToCostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_Rework_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Rework_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Rework_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.ReworkItem (ReworkID)

### PRM.ReworkItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReworkItemID | int | N |  | identity |
| 2 | ReworkID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Description | nvarchar(1000) | Y |  |  |
| 7 | Description2 | nvarchar(1000) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReworkItemID
- **FK** `FK_ReworkItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReworkItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReworkItem_Rework` (ReworkID) -> PRM.Rework (ReworkID) on delete CASCADE
- **FK** `FK_ReworkItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.ReworkItemTrace (ReworkItemID)

### PRM.ReworkItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReworkItemTraceID | int | N |  | identity |
| 2 | ReworkItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReworkItemTraceID
- **FK** `FK_ReworkItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReworkItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReworkItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReworkItemTrace_ReworkItem` (ReworkItemID) -> PRM.ReworkItem (ReworkItemID) on delete CASCADE
- **FK** `FK_ReworkItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_ReworkItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.SpoilageStatistic

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SpoilageStatisticID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CostCenterId | int | N |  |  |

- **Primary key:** SpoilageStatisticID
- **FK** `FK_SpoilageStatistic_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_SpoilageStatistic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SpoilageStatistic_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_SpoilageStatistic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.SpoilageStatisticItem (SpoilageStatisticID)

### PRM.SpoilageStatisticItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SpoilageStatisticItemID | int | N |  | identity |
| 2 | SpoilageStatisticID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Description | nvarchar(1000) | Y |  |  |
| 7 | Description2 | nvarchar(1000) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SpoilageStatisticItemID
- **FK** `FK_SpoilageStatisticItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_SpoilageStatisticItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SpoilageStatisticItem_SpoilageStatistic` (SpoilageStatisticID) -> PRM.SpoilageStatistic (SpoilageStatisticID) on delete CASCADE
- **FK** `FK_SpoilageStatisticItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.SpoilageStatisticItemTrace (SpoilageStatisticItemID)

### PRM.SpoilageStatisticItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SpoilageStatisticItemTraceID | int | N |  | identity |
| 2 | SpoilageStatisticItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** SpoilageStatisticItemTraceID
- **FK** `FK_SpoilageStatisticItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_SpoilageStatisticItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_SpoilageStatisticItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SpoilageStatisticItemTrace_SpoilageStatisticItem` (SpoilageStatisticItemID) -> PRM.SpoilageStatisticItem (SpoilageStatisticItemID) on delete CASCADE
- **FK** `FK_SpoilageStatisticItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_SpoilageStatisticItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.StandardConsumption

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StandardConsumptionID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | datetime | N |  |  |
| 4 | CostCenterID | int | N |  |  |
| 5 | Status | tinyint | N |  |  |
| 6 | StartDate | datetime | N |  |  |
| 7 | EndDate | datetime | N |  |  |
| 8 | OutgoingID | int | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** StandardConsumptionID
- **FK** `FK_StandardConsumption_CostCenter` (CostCenterID) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_StandardConsumption_Outgoing` (OutgoingID) -> STC.Outgoing (OutgoingID) on delete SET_NULL
- **FK** `FK_StandardConsumption_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StandardConsumption_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.StandardConsumptionItem (StandardConsumptionID)

### PRM.StandardConsumptionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StandardConsumptionItemID | int | N |  | identity |
| 2 | StandardConsumptionID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(36,10) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StandardConsumptionItemID
- **FK** `FK_StandardConsumptionItem_StandardConsumption` (StandardConsumptionID) -> PRM.StandardConsumption (StandardConsumptionID) on delete CASCADE
- **FK** `FK_StandardConsumptionItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StandardConsumptionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StandardConsumptionItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.StationPerformance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPerformanceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | BaseType | tinyint | N |  |  |
| 6 | ProductionPlanningID | int | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | WorkStationId | int | N |  |  |

- **Primary key:** StationPerformanceID
- **FK** `FK_StationPerformance_WorkStation` (WorkStationId) -> PRM.WorkStation (WorkStationID)
- **FK** `FK_StationPerformance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPerformance_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_StationPerformance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationPerformance_ProductionPlanning` (ProductionPlanningID) -> PRM.ProductionPlanning (ProductionPlanningID)
- **Referenced by:** PRM.StationPerformanceItem (StationPerformanceID)

### PRM.StationPerformanceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPerformanceItemID | int | N |  | identity |
| 2 | StationPerformanceID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | Description | nvarchar(1000) | Y |  |  |
| 7 | Description2 | nvarchar(1000) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StationPerformanceItemID
- **FK** `FK_StationPerformanceItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPerformanceItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationPerformanceItem_StationPerformance` (StationPerformanceID) -> PRM.StationPerformance (StationPerformanceID) on delete CASCADE
- **FK** `FK_StationPerformanceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** PRM.StationPerformanceItemTrace (StationPerformanceItemID)

### PRM.StationPerformanceItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StationPerformanceItemTraceID | int | N |  | identity |
| 2 | StationPerformanceItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** StationPerformanceItemTraceID
- **FK** `FK_StationPerformanceItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_StationPerformanceItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StationPerformanceItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StationPerformanceItemTrace_StationPerformanceItem` (StationPerformanceItemID) -> PRM.StationPerformanceItem (StationPerformanceItemID) on delete CASCADE
- **FK** `FK_StationPerformanceItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_StationPerformanceItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.StuffBomGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffBomGroupID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | BomGroupID | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StuffBomGroupID
- **FK** `FK_StuffBomGroup_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StuffBomGroup_BomGroup` (BomGroupID) -> PRM.BomGroup (BomGroupID)
- **FK** `FK_StuffBomGroup_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffBomGroup_CreatorUser` (Creator) -> CFG.User (UserID)

### PRM.WorkingInventory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkingInventoryID | int | N |  | identity |
| 2 | Type | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | CostCalculationPeriodID | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | CostCenterId | int | N |  |  |

- **Primary key:** WorkingInventoryID
- **FK** `FK_WorkingInventory_CostCenter` (CostCenterId) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_WorkingInventory_CostCalculationPeriod` (CostCalculationPeriodID) -> PRM.CostCalculationPeriod (CostCalculationPeriodID)
- **FK** `FK_WorkingInventory_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkingInventory_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.WorkingInventoryItem (WorkingInventoryID)

### PRM.WorkingInventoryItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkingInventoryItemID | int | N |  | identity |
| 2 | WorkingInventoryID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(1000) | Y |  |  |
| 8 | Description2 | nvarchar(1000) | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Price | decimal(36,10) | Y |  |  |
| 15 | CompletionPercentage | tinyint | N | ((100)) |  |

- **Primary key:** WorkingInventoryItemID
- **FK** `FK_WorkingInventoryItem_WorkingInventory` (WorkingInventoryID) -> PRM.WorkingInventory (WorkingInventoryID) on delete CASCADE
- **FK** `FK_WorkingInventoryItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_WorkingInventoryItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkingInventoryItem_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.WorkingInventoryItemTrace (WorkingInventoryItemID)

### PRM.WorkingInventoryItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkingInventoryItemTraceID | int | N |  | identity |
| 2 | WorkingInventoryItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** WorkingInventoryItemTraceID
- **FK** `FK_WorkingInventoryItemTrace_WorkingInventoryItem` (WorkingInventoryItemID) -> PRM.WorkingInventoryItem (WorkingInventoryItemID) on delete CASCADE
- **FK** `FK_WorkingInventoryItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_WorkingInventoryItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_WorkingInventoryItemTrace_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkingInventoryItemTrace_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_WorkingInventoryItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### PRM.WorkSchedule

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkScheduleID | int | N |  | identity |
| 2 | ProductionProcessID | int | N |  |  |
| 3 | FromDate | date | N |  |  |
| 4 | WorkShiftID | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** WorkScheduleID
- **unique constraint** `UC_WorkSchedule_ProductionProcessID_FromDate` (ProductionProcessID, FromDate)
- **FK** `FK_WorkSchedule_ProductionProcess` (ProductionProcessID) -> PRM.ProductionProcess (ProductionProcessID)
- **FK** `FK_WorkSchedule_WorkShift` (WorkShiftID) -> PRM.WorkShift (WorkShiftID)
- **FK** `FK_WorkSchedule_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkSchedule_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.WorkShift

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkShiftID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** WorkShiftID
- **FK** `FK_WorkShift_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkShift_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.WorkSchedule (WorkShiftID); PRM.WorkShiftItem (WorkShiftID)

### PRM.WorkShiftItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkShiftItemID | int | N |  | identity |
| 2 | WorkShiftID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Day | tinyint | N |  |  |
| 5 | WorkTime | nvarchar(MAX) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** WorkShiftItemID
- **FK** `FK_WorkShiftItem_WorkShift` (WorkShiftID) -> PRM.WorkShift (WorkShiftID) on delete CASCADE
- **FK** `FK_WorkShiftItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkShiftItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PRM.WorkStation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkStationID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CostCenterID | int | N |  |  |

- **Primary key:** WorkStationID
- **FK** `FK_WorkStation_CostCenter` (CostCenterID) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_WorkStation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkStation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PRM.CalculatedWorkStation (WorkStationID); PRM.CostDriverPeriodData (WorkStationID); PRM.ProductionProcessItem (WorkStationID); PRM.StationPerformance (WorkStationId)

## Views

### PRM.UsedSlsOnCostStructure

Definition: `programmability/views/PRM.UsedSlsOnCostStructure.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CostStructureID | int | N |
| 2 | SlID | int | N |

### PRM.vwCostCalculationSource

Definition: `programmability/views/PRM.vwCostCalculationSource.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CostStructureType | int | N |
| 2 | ProductionID | int | N |
| 3 | MaterialID | int | Y |
| 4 | SlID | int | Y |
| 5 | Quantity | decimal(36,10) | Y |
| 6 | StandardCost | decimal(36,10) | Y |
| 7 | DeviationShare | decimal(36,10) | Y |
| 8 | Cost | decimal(37,10) | Y |
| 9 | CostCenterId | int | N |
| 10 | CostCalculationPeriodID | int | N |
| 11 | ProductionQuantity | decimal(36,10) | Y |
| 12 | FinancialPeriodID | int | N |

### PRM.vwCostDataCollectionData

Definition: `programmability/views/PRM.vwCostDataCollectionData.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CostCalculationPeriodID | int | Y |
| 2 | CostStructureID | int | Y |
| 3 | CostDataCollectionAccountSettingID | int | N |
| 4 | CostDataCollectionSettingID | int | N |
| 5 | CostBehaviour | int | N |
| 6 | SlID | int | Y |
| 7 | CostDriverID | int | N |
| 8 | Title | nvarchar(256) | N |
| 9 | StartDate | date | N |
| 10 | EndDate | date | N |

### PRM.vwCostStructureParents

Definition: `programmability/views/PRM.vwCostStructureParents.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Level | bigint | Y |
| 2 | CostStructureID | int | Y |
| 3 | Layer | int | Y |
| 4 | ParentID | int | Y |
| 5 | Code | int | N |
| 6 | Title | nvarchar(250) | N |
| 7 | Title2 | nvarchar(250) | N |
| 8 | Type | tinyint | Y |
| 9 | ParentStructureTitle | nvarchar(250) | N |
| 10 | ParentStructureType | tinyint | Y |

### PRM.vwProductionOrderItem_UnplannedRemain

Definition: `programmability/views/PRM.vwProductionOrderItem_UnplannedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProductionOrderItemID | int | N |
| 2 | MainQuantityRemain | decimal(38,4) | Y |
| 3 | SubQuantityRemain | decimal(38,4) | Y |

### PRM.vwProductionPlanningItem_NONProduced

Definition: `programmability/views/PRM.vwProductionPlanningItem_NONProduced.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProductionPlanningItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | Produced | decimal(38,4) | N |
| 4 | Non | decimal(38,4) | Y |

### PRM.VWProductionStatisticItemRemain

Definition: `programmability/views/PRM.VWProductionStatisticItemRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProductionStatisticItemID | int | N |
| 2 | MainRemain | decimal(38,4) | Y |
| 3 | SubRemain | decimal(38,4) | Y |

### PRM.vwRequiredMaterialNonRequested

Definition: `programmability/views/PRM.vwRequiredMaterialNonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | RequiredMaterialCostCenterID | int | N |
| 2 | RequiredQuantity | decimal(36,10) | N |
| 3 | done | decimal(38,4) | Y |
| 4 | Non | decimal(38,4) | Y |

### PRM.vwRequiredProductNonRequested

Definition: `programmability/views/PRM.vwRequiredProductNonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | RequiredProductID | int | N |
| 2 | RequiredQuantity | decimal(30,4) | N |
| 3 | done | decimal(38,4) | Y |
| 4 | Non | decimal(38,4) | Y |

### PRM.vwSlInCostCalculationPeriod

Definition: `programmability/views/PRM.vwSlInCostCalculationPeriod.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | rno | bigint | Y |
| 2 | CostStructureID | int | Y |
| 3 | CostDataCollectionAccountSettingID | int | N |
| 4 | CostDataCollectionSettingID | int | N |
| 5 | CostBehaviour | int | N |
| 6 | SlID | int | Y |
| 7 | CostDriverID | int | N |
| 8 | Title | nvarchar(256) | N |
| 9 | StartDate | date | N |
| 10 | EndDate | date | N |
| 11 | CostCalculationPeriodID | int | N |

