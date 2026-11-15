# Schema `APS`

## Tables

### APS.AnalysisCube

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AnalysisCubeID | int | N |  | identity |
| 2 | Name | varchar(250) | N |  |  |
| 3 | Title | nvarchar(128) | N |  |  |
| 4 | IsActive | bit | N | ((1)) |  |
| 5 | Dimensions | varchar(4000) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | RelatedModules | varchar(50) | Y |  |  |

- **Primary key:** AnalysisCubeID
- **FK** `FK_AnalysisCube_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AnalysisCube_LastEditor` (LastEditor) -> CFG.User (UserID)

### APS.DimSaleItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | bigint | N |  |  |
| 2 | ItemId | bigint | N |  |  |
| 3 | ItemType | tinyint | N |  |  |
| 4 | ParentID | bigint | Y |  |  |
| 5 | DocumentID | bigint | Y |  |  |
| 6 | StuffID | int | Y |  |  |
| 7 | FinancialPeriodID | int | Y |  |  |
| 8 | Number | int | Y |  |  |
| 9 | Date | date | Y |  |  |
| 10 | SaleTypeID | int | Y |  |  |
| 11 | SaleModel | smallint | Y |  |  |
| 12 | DlID | bigint | Y |  |  |
| 13 | BranchID | int | Y |  |  |
| 14 | ItemRowIndex | int | Y |  |  |
| 15 | Status | int | Y |  |  |
| 16 | HeaderID | int | Y |  |  |
| 17 | SaleAreaID | int | Y |  |  |

- **Primary key:** Id
- **FK** `FK_DimSaleItem_DimSaleItemType` (ItemType) -> APS.DimSaleItemType (Id)
- **FK** `FK_DimSaleItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_DimSaleItem_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_DimSaleItem_DimDate` (Date) -> CFG.DimDate (Date)
- **FK** `FK_DimSaleItem_SaleType` (SaleTypeID) -> SLE.SaleType (SaleTypeID)
- **FK** `FK_DimSaleItem_SaleArea` (SaleAreaID) -> SLE.SaleArea (SaleAreaID)
- **FK** `FK_DimSaleItem_SaleModel` (SaleModel) -> SLE.SaleModel (SaleModelID)
- **FK** `FK_DimSaleItem_DL` (DlID) -> ACC.DL (DLID)

### APS.DimSaleItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DimSaleItemTraceId | bigint | N |  | identity |
| 2 | DimSaleItemId | bigint | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |

- **Primary key:** DimSaleItemTraceId

### APS.DimSaleItemType

Rows: 9

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | tinyint | N |  |  |
| 2 | Title | nvarchar(50) | N |  |  |

- **Primary key:** Id
- **Referenced by:** APS.DimSaleItem (ItemType)

### APS.FactSaleItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | bigint | N |  | identity |
| 2 | ParentId | bigint | N |  |  |
| 3 | ChildId | bigint | Y |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | BaseMainQuantity | decimal(30,4) | N |  |  |
| 7 | BaseSubQuantity | decimal(30,4) | Y |  |  |

- **Primary key:** Id

## Views

### APS.DimCalendarMonth

Definition: `programmability/views/APS.DimCalendarMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CalendarMonthID | int | N |
| 2 | Year | smallint | N |
| 3 | MonthNumber | tinyint | N |
| 4 | MonthName | nvarchar(100) | N |
| 5 | Title | nvarchar(111) | Y |
| 6 | OrderID | int | Y |

### APS.DimInvoiceStatus

Definition: `programmability/views/APS.DimInvoiceStatus.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | tinyint | Y |
| 2 | Title | nvarchar(5) | N |

### APS.DimParameter

Definition: `programmability/views/APS.DimParameter.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ParameterID | int | N |
| 2 | Title | nvarchar(250) | N |
| 3 | CategoryTitle | nvarchar(250) | N |
| 4 | ParameterTypeTitle | nvarchar(250) | N |

### APS.DimPersonel

Definition: `programmability/views/APS.DimPersonel.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | Code | nvarchar(100) | N |
| 3 | Title | nvarchar(513) | Y |
| 4 | Age | int | Y |
| 5 | Sex | varchar(3) | N |

### APS.DimPersonelAgreement

Definition: `programmability/views/APS.DimPersonelAgreement.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | bigint | Y |
| 2 | PersonelID | int | Y |
| 3 | CalendarMonthID | int | N |
| 4 | CostCenterID | int | N |
| 5 | JobID | int | N |
| 6 | PositionID | int | Y |
| 7 | EmploymentTypeID | int | N |
| 8 | EmploymentStatusID | tinyint | Y |
| 9 | WorkPlaceID | int | N |
| 10 | PayrollGroupID | int | Y |
| 11 | PayrollBaseID | int | Y |
| 12 | OccupationGradeID | int | Y |
| 13 | BranchID | int | N |
| 14 | PersonelVoucherSettingID | int | Y |
| 15 | PayrollAccGroupID | tinyint | Y |

### APS.DimPersonelVoucherSetting

Definition: `programmability/views/APS.DimPersonelVoucherSetting.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | bigint | Y |
| 2 | PersonelID | int | Y |
| 3 | CalendarMonthID | int | N |
| 4 | PayrollAccGroupID | tinyint | N |
| 5 | PersonelVoucherSettingID | int | Y |

### APS.DimSaleBaseDocument

Definition: `programmability/views/APS.DimSaleBaseDocument.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | tinyint | Y |
| 2 | title | nvarchar(15) | N |

### APS.DimSaleDocument

Definition: `programmability/views/APS.DimSaleDocument.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | Title | nvarchar(10) | N |

### APS.DimSl

Definition: `programmability/views/APS.DimSl.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SlID | int | N |
| 2 | KolTitle | nvarchar(256) | N |
| 3 | KolCode | varchar(100) | N |
| 4 | GrouTitle | nvarchar(256) | N |
| 5 | GroupCode | varchar(50) | N |
| 6 | SlTitle | nvarchar(256) | N |
| 7 | SlCode | varchar(150) | N |
| 8 | BalanceType | nvarchar(256) | N |
| 9 | HasCurrency | bit | N |
| 10 | FullName | nvarchar(409) | N |

### APS.FactCalculate

Definition: `programmability/views/APS.FactCalculate.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | bigint | Y |
| 2 | CalculationTypeID | tinyint | N |
| 3 | CalendarMonthID | int | N |
| 4 | PersonelID | int | N |
| 5 | ParameterID | int | Y |
| 6 | ParameterValueTypeID | int | N |
| 7 | Value | decimal(30,10) | N |

### APS.FactPersonelVoucherSettingDl

Definition: `programmability/views/APS.FactPersonelVoucherSettingDl.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelVoucherSettingDlID | int | N |
| 2 | PersonelVoucherSettingID | int | N |
| 3 | DlTypeID | int | N |
| 4 | DlID | bigint | N |

### APS.FactSale

Definition: `programmability/views/APS.FactSale.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | InvoiceID | int | N |
| 2 | FinancialPeriodID | int | N |
| 3 | BranchID | int | N |
| 4 | BaseDocument | tinyint | N |
| 5 | CustomerID | bigint | N |
| 6 | AddressID | int | Y |
| 7 | Date | date | N |
| 8 | CurrencyID | int | N |
| 9 | CurrencyRate | decimal(20,10) | N |
| 10 | SaleAgentID | int | Y |
| 11 | Percentage | int | N |
| 12 | PercentageInBaseCurrency | int | N |
| 13 | SaleInvoiceStatus | tinyint | N |
| 14 | SaleTypeID | int | N |
| 15 | SaleModelID | smallint | N |
| 16 | StuffID | int | N |
| 17 | MainQuantity | decimal(36,10) | Y |
| 18 | SubQuantity | decimal(36,10) | Y |
| 19 | Fee | decimal(36,10) | Y |
| 20 | Price | decimal(36,10) | Y |
| 21 | Discount | decimal(36,10) | Y |
| 22 | Tax | decimal(36,10) | Y |
| 23 | Duty | decimal(36,10) | Y |
| 24 | NetPrice | decimal(38,10) | Y |
| 25 | JustificationItemID | int | Y |
| 26 | QuotationItemID | int | Y |
| 27 | RemittanceItemID | int | Y |
| 28 | OutgoingItemId | int | Y |
| 29 | ContractSubjectID | int | Y |
| 30 | ConfirmStatementID | int | N |
| 31 | SaleItemID | int | Y |
| 32 | FeeInBaseCurrency | decimal(38,6) | Y |
| 33 | PriceInBaseCurrency | decimal(38,6) | Y |
| 34 | DiscountInBaseCurrency | decimal(38,6) | Y |
| 35 | TaxInBaseCurrency | decimal(38,6) | Y |
| 36 | DutyInBaseCurrency | decimal(38,6) | Y |
| 37 | NetPriceInBaseCurrency | decimal(38,6) | Y |
| 38 | ReceptionID | int | Y |
| 39 | AllocationSharingAmount | decimal(36,10) | Y |
| 40 | InvoiceMultiplicy | int | N |
| 41 | SaleDocument | int | N |
| 42 | DateId | int | N |

### APS.FactVoucher

Definition: `programmability/views/APS.FactVoucher.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | VoucherItemID | int | N |
| 2 | DocumentTypeID | smallint | N |
| 3 | BranchID | int | N |
| 4 | FinancialPeriodID | int | N |
| 5 | DateId | int | N |
| 6 | VoucherStatusID | smallint | N |
| 7 | CurrencyID | int | N |
| 8 | CurrencyRate | decimal(20,10) | N |
| 9 | Debit | decimal(30,4) | N |
| 10 | Credit | decimal(30,4) | N |
| 11 | CurrencyDebit | decimal(30,4) | N |
| 12 | CurrencyCredit | decimal(30,4) | N |
| 13 | VoucherID | int | N |
| 14 | SlID | int | N |

### APS.FactVoucherDL

Definition: `programmability/views/APS.FactVoucherDL.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ID | bigint | Y |
| 2 | VoucherItemID | int | N |
| 3 | AccountLevelID | int | N |
| 4 | DlID | bigint | Y |

