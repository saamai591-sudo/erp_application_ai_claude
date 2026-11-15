# Schema `FSS`

## Tables

### FSS.CodingReportStructure

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CodingReportStructureID | int | N |  | identity |
| 2 | ReportID | int | N |  |  |
| 3 | ImportanceLevelColumn | int | Y |  |  |
| 4 | ImportanceLevelValue | int | Y |  |  |
| 5 | SortBaseColumn | int | Y |  |  |
| 6 | SortBaseType | tinyint | Y |  |  |
| 7 | DocumentTypeIds | nvarchar(255) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CodingReportStructureID
- **FK** `FK_CodingReportStructure_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructure_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructure_Report` (ReportID) -> FSS.Report (ReportID)
- **Referenced by:** FSS.CodingReportStructureSl (CodingReportStructureID)

### FSS.CodingReportStructureSl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CodingReportStructureSlID | int | N |  | identity |
| 2 | CodingReportStructureID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | AccountLevelID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CodingReportStructureSlID
- **FK** `FK_CodingReportStructureSl_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_CodingReportStructureSl_CodingReportStructure` (CodingReportStructureID) -> FSS.CodingReportStructure (CodingReportStructureID) on delete CASCADE
- **FK** `FK_CodingReportStructureSl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructureSl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructureSl_Sl` (SlID) -> ACC.SL (SlID)
- **Referenced by:** FSS.CodingReportStructureSlReportColumn (CodingReportStructureSlID)

### FSS.CodingReportStructureSlReportColumn

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CodingReportStructureSlReportColumnID | int | N |  | identity |
| 2 | CodingReportStructureSlID | int | N |  |  |
| 3 | ReportColumnID | int | N |  |  |
| 4 | DataType | tinyint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CodingReportStructureSlReportColumnID
- **FK** `FK_CodingReportStructureSlReportColumn_CodingReportStructureSl` (CodingReportStructureSlID) -> FSS.CodingReportStructureSl (CodingReportStructureSlID) on delete CASCADE
- **FK** `FK_CodingReportStructureSlReportColumn_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructureSlReportColumn_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CodingReportStructureSlReportColumn_ReportColumn` (ReportColumnID) -> FSS.ReportColumn (ReportColumnID)

### FSS.FinancialStatement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FinancialStatementID | int | N |  | identity |
| 2 | Title | nvarchar(1024) | N |  |  |
| 3 | Title2 | nvarchar(1024) | N |  |  |
| 4 | ToDate | date | N |  |  |
| 5 | ComparativeFinancialStatementID | int | Y |  |  |
| 6 | FinancialPeriodID | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FinancialStatementID
- **FK** `FK_FinancialStatement_ComparativeFinancialStatement` (ComparativeFinancialStatementID) -> FSS.FinancialStatement (FinancialStatementID)
- **FK** `FK_FinancialStatement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FinancialStatement_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_FinancialStatement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FSS.FinancialStatement (ComparativeFinancialStatementID); FSS.Report (FinancialStatementID)

### FSS.Report

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportID | int | N |  | identity |
| 2 | FinancialStatementID | int | N |  |  |
| 3 | DataType | tinyint | N |  |  |
| 4 | ReportType | tinyint | N |  |  |
| 5 | ParentReportID | int | Y |  |  |
| 6 | Number | int | N |  |  |
| 7 | Title | nvarchar(1024) | N |  |  |
| 8 | Title2 | nvarchar(1024) | N |  |  |
| 9 | PreReportText | ntext | Y |  |  |
| 10 | PreReportText2 | ntext | Y |  |  |
| 11 | PostReportText | ntext | Y |  |  |
| 12 | PostReportText2 | ntext | Y |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | Orientation | tinyint | N | ((1)) |  |

- **Primary key:** ReportID
- **FK** `FK_Report_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Report_FinancialStatement` (FinancialStatementID) -> FSS.FinancialStatement (FinancialStatementID)
- **FK** `FK_Report_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Report_ParentReport` (ParentReportID) -> FSS.Report (ReportID)
- **Referenced by:** FSS.CodingReportStructure (ReportID); FSS.Report (ParentReportID); FSS.ReportColumn (ReportID); FSS.ReportResult (ReportID); FSS.Topic (ParentReportID); FSS.Topic (ReferReportID)

### FSS.ReportColumn

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportColumnID | int | N |  | identity |
| 2 | ReportID | int | N |  |  |
| 3 | Title | nvarchar(1024) | N |  |  |
| 4 | Title2 | nvarchar(1024) | N |  |  |
| 5 | ColumnType | tinyint | N |  |  |
| 6 | ComparativeColumnID | int | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | RowIndex | smallint | N |  |  |

- **Primary key:** ReportColumnID
- **FK** `FK_ReportColumn_ComparativeColumn` (ComparativeColumnID) -> FSS.ReportColumn (ReportColumnID)
- **FK** `FK_ReportColumn_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReportColumn_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReportColumn_Report` (ReportID) -> FSS.Report (ReportID) on delete CASCADE
- **Referenced by:** FSS.CodingReportStructureSlReportColumn (ReportColumnID); FSS.ReportColumn (ComparativeColumnID); FSS.ReportResult (ReportColumnID); FSS.TopicReportStructure (ReportColumnID)

### FSS.ReportResult

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportResultID | bigint | N |  | identity |
| 2 | ReportID | int | N |  |  |
| 3 | ReportColumnID | int | N |  |  |
| 4 | TopicID | int | Y |  |  |
| 5 | DlID | bigint | Y |  |  |
| 6 | Value | decimal(18,4) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReportResultID
- **FK** `FK_ReportResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReportResult_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReportResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReportResult_Report` (ReportID) -> FSS.Report (ReportID)
- **FK** `FK_ReportResult_ReportColumn` (ReportColumnID) -> FSS.ReportColumn (ReportColumnID)
- **FK** `FK_ReportResult_Topic` (TopicID) -> FSS.Topic (TopicID)

### FSS.Topic

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TopicID | int | N |  | identity |
| 2 | ParentReportID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Title | nvarchar(1024) | N |  |  |
| 5 | Title2 | nvarchar(1024) | N |  |  |
| 6 | DataType | tinyint | N |  |  |
| 7 | ReferReportID | int | Y |  |  |
| 8 | ComparativeTopicID | int | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Level | tinyint | Y |  |  |

- **Primary key:** TopicID
- **FK** `FK_Topic_ComparativeTopic` (ComparativeTopicID) -> FSS.Topic (TopicID)
- **FK** `FK_Topic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Topic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Topic_ParentReport` (ParentReportID) -> FSS.Report (ReportID)
- **FK** `FK_Topic_ReferReport` (ReferReportID) -> FSS.Report (ReportID)
- **Referenced by:** FSS.ReportResult (TopicID); FSS.Topic (ComparativeTopicID); FSS.TopicReportStructure (TopicID)

### FSS.TopicReportStructure

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TopicReportStructureID | int | N |  | identity |
| 2 | TopicID | int | N |  |  |
| 3 | ReportColumnID | int | N |  |  |
| 4 | CalculationType | tinyint | N |  |  |
| 5 | DataType | tinyint | Y |  |  |
| 6 | FormulaExpression | varchar(MAX) | Y |  |  |
| 7 | FormulaSqlExpression | varchar(MAX) | Y |  |  |
| 8 | DocumentTypeIds | nvarchar(255) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TopicReportStructureID
- **FK** `FK_TopicReportStructure_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructure_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructure_ReportColumn` (ReportColumnID) -> FSS.ReportColumn (ReportColumnID)
- **FK** `FK_TopicReportStructure_Topic` (TopicID) -> FSS.Topic (TopicID)
- **Referenced by:** FSS.TopicReportStructureCoding (TopicReportStructureID); FSS.TopicReportStructureFormulaPrameter (TopicReportStructureID)

### FSS.TopicReportStructureCoding

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TopicReportStructureCodingID | int | N |  | identity |
| 2 | TopicReportStructureID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TopicReportStructureCodingID
- **FK** `FK_TopicReportStructureCoding_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureCoding_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureCoding_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_TopicReportStructureCoding_TopicReportStructure` (TopicReportStructureID) -> FSS.TopicReportStructure (TopicReportStructureID) on delete CASCADE
- **Referenced by:** FSS.TopicReportStructureCodingAccountLevel (TopicReportStructureCodingID)

### FSS.TopicReportStructureCodingAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TopicReportStructureCodingAccountLevelID | int | N |  | identity |
| 2 | TopicReportStructureCodingID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TopicReportStructureCodingAccountLevelID
- **FK** `FK_TopicReportStructureCodingAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_TopicReportStructureCodingAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureCodingAccountLevel_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TopicReportStructureCodingAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureCodingAccountLevel_TopicReportStructureCoding` (TopicReportStructureCodingID) -> FSS.TopicReportStructureCoding (TopicReportStructureCodingID) on delete CASCADE

### FSS.TopicReportStructureFormulaPrameter

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TopicReportStructureFormulaPrameterID | int | N |  | identity |
| 2 | TopicReportStructureID | int | N |  |  |
| 3 | RelatedTopicReportStructureID | int | N |  |  |
| 4 | ItemValueTypeID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TopicReportStructureFormulaPrameterID
- **FK** `FK_TopicReportStructureFormulaPrameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureFormulaPrameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TopicReportStructureFormulaPrameter_TopicReportStructure` (TopicReportStructureID) -> FSS.TopicReportStructure (TopicReportStructureID)

