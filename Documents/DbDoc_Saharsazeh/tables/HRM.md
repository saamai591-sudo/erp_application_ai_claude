# Schema `HRM`

## Tables

### HRM.Agreement

Rows: 1511 | قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementID | int | N |  | identity |
| 2 | AgreementTypeID | tinyint | N |  |  |
| 3 | ConfirmDate | date | Y |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | IssueDate | date | N |  |  |
| 7 | ExecuteDate | date | N |  |  |
| 8 | EmploymentDate | date | N |  |  |
| 9 | ExpireDate | date | Y |  |  |
| 10 | EmploymentTypeID | int | N |  |  |
| 11 | EmploymentStatusID | tinyint | Y |  |  |
| 12 | WorkPlaceID | int | N |  |  |
| 13 | CostCenterID | int | N |  |  |
| 14 | PositionID | int | Y |  |  |
| 15 | JobID | int | N |  |  |
| 16 | Specification | nvarchar(MAX) | Y |  |  |
| 17 | Specification2 | nvarchar(MAX) | Y |  |  |
| 18 | ConfirmedBy | int | Y |  |  |
| 19 | PayrollGroupID | int | Y |  |  |
| 20 | PayrollBaseID | int | Y |  |  |
| 21 | OccupationGradeID | int | Y |  |  |
| 22 | Serial | int | N | ((1)) |  |
| 23 | ExperienceLen | int | Y |  |  |
| 24 | BranchID | int | N | ((-1)) |  |
| 25 | Version | int | N |  |  |
| 26 | Creator | int | N |  |  |
| 27 | CreationDate | datetime | N |  |  |
| 28 | LastEditor | int | N |  |  |
| 29 | LastEditionDate | datetime | N |  |  |
| 30 | OrganizationUnitID | int | Y |  |  |
| 31 | IsManagerToOrganizationUnit | bit | N | ((0)) |  |

- **Primary key:** AgreementID
- **FK** `FK_Agreement_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_Agreement_AgreementType` (AgreementTypeID) -> HRM.AgreementType (AgreementTypeID)
- **FK** `FK_Agreement_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Agreement_ConfirmedBy` (ConfirmedBy) -> CFG.User (UserID)
- **FK** `FK_Agreement_CostCenter` (CostCenterID) -> CFG.CostCenter (CostCenterID)
- **FK** `FK_Agreement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Agreement_EmploymentStatus` (EmploymentStatusID) -> HRM.EmploymentStatus (EmploymentStatusID)
- **FK** `FK_Agreement_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID)
- **FK** `FK_Agreement_Job` (JobID) -> HRM.Job (JobID)
- **FK** `FK_Agreement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Agreement_OccupationGrade` (OccupationGradeID) -> HRM.OccupationGrade (OccupationGradeID)
- **FK** `FK_Agreement_PayrollBase` (PayrollBaseID) -> HRM.PayrollBase (PayrollBaseID)
- **FK** `FK_Agreement_PayrollGroup` (PayrollGroupID) -> HRM.PayrollGroup (PayrollGroupID)
- **FK** `FK_Agreement_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_Agreement_Position` (PositionID) -> HRM.Position (PositionID)
- **FK** `FK_Agreement_WorkPlace` (WorkPlaceID) -> HRM.WorkPlace (WorkPlaceID)
- **Referenced by:** HRM.AgreementBaseValue (AgreementID); HRM.AgreementOrganization (AgreementID); HRM.AgreementParameter (AgreementID); HRM.AgreementTranscript (AgreementID)

### HRM.AgreementBaseValue

Rows: 0 | مقادیر ضرایب قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementBaseValueID | int | N |  | identity |
| 2 | AgreementID | int | N |  |  |
| 3 | BaseValueID | int | N |  |  |
| 4 | Value | decimal(18,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** AgreementBaseValueID
- **FK** `FK_AgreementBaseValue_Agreement` (AgreementID) -> HRM.Agreement (AgreementID) on delete CASCADE
- **FK** `FK_AgreementBaseValue_BaseValue` (BaseValueID) -> HRM.BaseValue (BaseValueID)
- **FK** `FK_AgreementBaseValue_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementBaseValue_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.AgreementBatchModel

Rows: 2 | مدل قرارداد گروهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementBatchModelID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | EmploymentTypeID | int | N |  |  |
| 5 | AgreementTypeID | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** AgreementBatchModelID
- **FK** `FK_AgreementBatchModel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementBatchModel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementBatchModelFormula (AgreementBatchModelID)

### HRM.AgreementBatchModelFormula

Rows: 21 | فرمول مدل قرارداد گروهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementBatchModelFormulaID | int | N |  | identity |
| 2 | AgreementBatchModelID | int | N |  |  |
| 3 | ParameterID | int | N |  |  |
| 4 | Title | nvarchar(512) | N |  |  |
| 5 | Expression | varchar(MAX) | N |  |  |
| 6 | Condition | varchar(MAX) | Y |  |  |
| 7 | SQLExpression | nvarchar(MAX) | Y |  |  |
| 8 | SQLCondition | nvarchar(MAX) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AgreementBatchModelFormulaID
- **FK** `FK_AgreementBatchModelFormula_AgreementBatchModel` (AgreementBatchModelID) -> HRM.AgreementBatchModel (AgreementBatchModelID) on delete CASCADE
- **FK** `FK_AgreementBatchModelFormula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementBatchModelFormula_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementBatchModelFormula_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **Referenced by:** HRM.AgreementBatchModelFormulaParameter (AgreementBatchModelFormulaID)

### HRM.AgreementBatchModelFormulaParameter

Rows: 19 | عامل های فرمول مدل قرارداد گروهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementBatchModelFormulaParameterID | int | N |  | identity |
| 2 | AgreementBatchModelFormulaID | int | N |  |  |
| 3 | ParameterID | int | Y |  |  |
| 4 | ParameterValueTypeID | int | Y |  |  |
| 5 | CalculationAggregateFunctionID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AgreementBatchModelFormulaParameterID
- **FK** `FK_AgreementBatchModelFormulaParameter_AgreementBatchModelFormula` (AgreementBatchModelFormulaID) -> HRM.AgreementBatchModelFormula (AgreementBatchModelFormulaID) on delete CASCADE
- **FK** `FK_AgreementBatchModelFormulaParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementBatchModelFormulaParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementBatchModelFormulaParameter_ParameterValueType` (ParameterValueTypeID) -> PAY.ParameterValueType (ParameterValueTypeID)

### HRM.AgreementOrganization

Rows: 2975 | سازمان قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementOrganizationID | int | N |  | identity |
| 2 | AgreementID | int | N |  |  |
| 3 | OrganizationItemID | int | N |  |  |
| 4 | TaxTableTypeID | int | Y |  |  |
| 5 | AssignmentDate | date | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AgreementOrganizationID
- **FK** `FK_AgreementOrganization_Agreement` (AgreementID) -> HRM.Agreement (AgreementID) on delete CASCADE
- **FK** `FK_AgreementOrganization_AOrganizationItem` (OrganizationItemID) -> HRM.OrganizationItem (OrganizationItemID)
- **FK** `FK_AgreementOrganization_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementOrganization_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementOrganization_TaxTableType` (TaxTableTypeID) -> HRM.TaxTableType (TaxTableTypeID)

### HRM.AgreementParameter

Rows: 12046 | عامل در قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementParameterID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | AgreementID | int | N |  |  |
| 4 | ParameterID | int | N |  |  |
| 5 | Amount | decimal(30,4) | N |  |  |
| 6 | ExecuteDate | date | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AgreementParameterID
- **index** `Agreement_Amount` (AgreementID) include (Amount)
- **unique index** `IX_AgreementParameter` (AgreementID, ParameterID)
- **FK** `FK_AgreementParameter_Agreement` (AgreementID) -> HRM.Agreement (AgreementID) on delete CASCADE
- **FK** `FK_AgreementParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementParameter_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)

### HRM.AgreementTranscript

Rows: 0 | رونویس قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTranscriptID | int | N |  | identity |
| 2 | AgreementID | int | N |  |  |
| 3 | AgreementTypeTranscriptID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** AgreementTranscriptID
- **FK** `FK_AgreementTranscript_Agreement` (AgreementID) -> HRM.Agreement (AgreementID) on delete CASCADE
- **FK** `FK_AgreementTranscript_AgreementTypeTranscript` (AgreementTypeTranscriptID) -> HRM.AgreementTypeTranscript (AgreementTypeTranscriptID)
- **FK** `FK_AgreementTranscript_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementTranscript_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.AgreementType

Rows: 8 | نوع قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTypeID | tinyint | N |  | identity |
| 2 | AgreementTypeFormID | tinyint | Y |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Title2 | nvarchar(512) | N |  |  |
| 5 | Code | varchar(50) | N |  |  |
| 6 | Desc | nvarchar(2048) | Y |  |  |
| 7 | PrePersonelStatusID | int | Y |  |  |
| 8 | NeedConfirmation | bit | N | ((1)) |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | IsStartType | bit | N | ((0)) |  |

- **Primary key:** AgreementTypeID
- **unique index** `IX_AgreementType_Code` (Code)
- **FK** `FK_AgreementType_AgreementTypeForm` (AgreementTypeFormID) -> HRM.AgreementTypeForm (AgreementTypeFormID)
- **FK** `FK_AgreementType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementType_PersonelStatus` (PrePersonelStatusID) -> HRM.PersonelStatus (PersonelStatusID)
- **Referenced by:** HRM.Agreement (AgreementTypeID); HRM.AgreementTypeInterpretation (AgreementTypeID); HRM.AgreementTypePrePersonelStatus (AgreementTypeID); HRM.AgreementTypeTranscript (AgreementTypeID)

### HRM.AgreementTypeForm

Rows: 1 | ماهیت نوع قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTypeFormID | tinyint | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | N |  |  |
| 5 | IsAmountEditable | bit | N | ((1)) |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** AgreementTypeFormID
- **FK** `FK_AgreementTypeForm_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementTypeForm_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementType (AgreementTypeFormID)

### HRM.AgreementTypeInterpretation

Rows: 0 | تفسیر نوع قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTypeInterpretationID | int | N |  | identity |
| 2 | AgreementTypeID | tinyint | N |  |  |
| 3 | PaymentSystemID | int | N |  |  |
| 4 | ParameterID | int | N |  |  |
| 5 | InterpretationType | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** AgreementTypeInterpretationID
- **FK** `FK_AgreementTypeInterpretation_AgreementType` (AgreementTypeID) -> HRM.AgreementType (AgreementTypeID)
- **FK** `FK_AgreementTypeInterpretation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementTypeInterpretation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementTypeInterpretation_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_AgreementTypeInterpretation_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)

### HRM.AgreementTypePrePersonelStatus

Rows: 10 | وضعیت های مجاز نوع قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTypePrePersonelStatusID | int | N |  | identity |
| 2 | AgreementTypeID | tinyint | N |  |  |
| 3 | PersonelStatusID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** AgreementTypePrePersonelStatusID
- **FK** `FK_AgreementTypePrePersonelStatus_AgreementType` (AgreementTypeID) -> HRM.AgreementType (AgreementTypeID) on delete CASCADE
- **FK** `FK_AgreementTypePrePersonelStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementTypePrePersonelStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AgreementTypePrePersonelStatus_PersonelStatus` (PersonelStatusID) -> HRM.PersonelStatus (PersonelStatusID)

### HRM.AgreementTypeTranscript

Rows: 0 | رونوشت نوع قرارداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AgreementTypeTranscriptID | int | N |  | identity |
| 2 | AgreementTypeID | tinyint | N |  |  |
| 3 | Title | nvarchar(2018) | N |  |  |
| 4 | Title2 | nvarchar(2048) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** AgreementTypeTranscriptID
- **FK** `FK_AgreementTypeTranscript_AgreementType` (AgreementTypeID) -> HRM.AgreementType (AgreementTypeID) on delete CASCADE
- **FK** `FK_AgreementTypeTranscript_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AgreementTypeTranscript_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementTranscript (AgreementTypeTranscriptID)

### HRM.BaseValue

Rows: 0 | ضریب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BaseValueID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | MinValue | decimal(18,4) | Y |  |  |
| 5 | MaxValue | decimal(18,4) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** BaseValueID
- **FK** `FK_BaseValue_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BaseValue_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementBaseValue (BaseValueID); HRM.BaseValueData (BaseValueID); HRM.BaseValuePaymentSystem (BaseValueID)

### HRM.BaseValueData

Rows: 0 | مقادیر ضرایب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BaseValueDataID | int | N |  | identity |
| 2 | BaseValueID | int | N |  |  |
| 3 | PaymentSystemID | int | N |  |  |
| 4 | ApplyDate | date | N |  |  |
| 5 | GroupID | int | Y |  |  |
| 6 | BaseID | int | Y |  |  |
| 7 | OccupationGradeID | int | Y |  |  |
| 8 | JobID | int | Y |  |  |
| 9 | PersonelID | int | Y |  |  |
| 10 | JobGroupID | tinyint | Y |  |  |
| 11 | Value | decimal(18,4) | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |
| 17 | IssueDate | date | N | (getdate()) |  |

- **Primary key:** BaseValueDataID
- **unique index** `IX_BaseValueData` (BaseID, BaseValueID, GroupID, IssueDate, JobGroupID, JobID, OccupationGradeID, PaymentSystemID, PersonelID)
- **FK** `FK_BaseValueData_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BaseValueData_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **FK** `FK_BaseValueData_BaseValue` (BaseValueID) -> HRM.BaseValue (BaseValueID)
- **FK** `FK_BaseValueData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BaseValueData_JobGroup` (JobGroupID) -> HRM.JobGroup (JobGroupID)

### HRM.BaseValuePaymentSystem

Rows: 0 | ارتباط نظام پرداخت  با ضریب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BaseValuePaymentSystemID | int | N |  | identity |
| 2 | BaseValueID | int | N |  |  |
| 3 | PaymentSystemID | int | N |  |  |
| 4 | HasGroup | bit | N |  |  |
| 5 | HasBase | bit | N |  |  |
| 6 | HasOccupationGrade | bit | N |  |  |
| 7 | HasJob | bit | N |  |  |
| 8 | HasPersonel | bit | N |  |  |
| 9 | HasAgreement | bit | N | ((0)) |  |
| 10 | HasJobGroup | bit | N | ((0)) |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |

- **Primary key:** BaseValuePaymentSystemID
- **unique index** `IX_BaseValuePaymentSystem` (BaseValueID, PaymentSystemID)
- **FK** `FK_BaseValuePaymentSystem_BaseValue` (BaseValueID) -> HRM.BaseValue (BaseValueID) on delete CASCADE
- **FK** `FK_BaseValuePaymentSystem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BaseValuePaymentSystem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BaseValuePaymentSystem_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)

### HRM.Calendar

Rows: 9 | تقویم کاری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalendarID | int | N |  | identity |
| 2 | Year | smallint | N |  |  |
| 3 | WorkHours | decimal(18,0) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalendarID
- **unique index** `IX_Year` (Year)
- **FK** `FK_Calendar_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Calendar_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.CalendarMonth (CalendarID)

### HRM.CalendarMonth

Rows: 108 | ماه تقویم کاری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalendarMonthID | int | N |  | identity |
| 2 | CalendarID | int | N |  |  |
| 3 | MonthNumber | tinyint | N |  |  |
| 4 | MonthName | nvarchar(100) | N |  |  |
| 5 | StartDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | StandardDays | tinyint | N |  |  |
| 8 | PermittedDays | tinyint | N |  |  |
| 9 | StandardHours | int | N |  |  |
| 10 | PermittedHours | int | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | AttendanceStartDate | date | Y |  |  |
| 17 | AttendanceEndDate | date | Y |  |  |

- **Primary key:** CalendarMonthID
- **FK** `FK_CalendarMonth_Calendar` (CalendarID) -> HRM.Calendar (CalendarID) on delete CASCADE
- **FK** `FK_CalendarMonth_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalendarMonth_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceCalculationMethod (CalendarMonthID); ATN.AttendanceCalculationPersonnel (CalendarMonthID); ATN.GroupAssignment (CalendarMonthID); ATN.VacancyEdition (CalendarMonthID); ATN.VacancyEstablishment (CalendarMonthID); ATN.VacancyTypeAssignmentItem (CalendarMonthID); HRM.PaymentSystemCalculationMethod (EfficientCalendarMonthID); HRM.PaymentSystemCalculationMethod (GenerateCalendarMonthID); HRM.TaxTable (CalendarMonthID); PAY.CalculationMethod (EfficientCalendarMonthID); PAY.CalculationMethod (GenerateCalendarMonthID); PAY.CalculationPersonel (CalendarMonthID); PAY.Establishment (CalendarMonthID); PAY.Loan (CalendarMonthID); PAY.ParameterConstantData (CalendarMonthID); PAY.ParameterMonthlyData (CalendarMonthID); PAY.PayPreparing (CalendarMonthID); PAY.PayrollAccConfiguration (CalendarMonthID); PAY.PersonelVoucherSetting (CalendarMonthID); PAY.Postpone (EndCalendarMonthID); PAY.Postpone (StartCalendarMonthID); PAY.TimeSheet (CalendarMonthID)

### HRM.CertificateType

Rows: 0 | نوع گواهینامه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CertificateTypeID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CertificateTypeID
- **FK** `FK_CertificateType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CertificateType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Education (CertificateTypeID)

### HRM.ChangePersonelStatus1

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ChangePersonelStatusId | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | Status | tinyint | N |  |  |
| 4 | ChangeDate | date | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ChangePersonelStatusId
- **unique index** `IX_ChangePersonelStatus` (PersonelID, ChangeDate)
- **FK** `FK_ChangePersonelStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ChangePersonelStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ChangePersonelStatus_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### HRM.Confirmation

Rows: 0 | گواهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmationID | int | N |  | identity |
| 2 | ConfirmationTypeID | int | N |  |  |
| 3 | Number | int | Y |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | IssueDate | date | N |  |  |
| 6 | Reciver | nvarchar(1024) | Y |  |  |
| 7 | ReciverPerson | nvarchar(1024) | Y |  |  |
| 8 | Amount | decimal(18,4) | Y |  |  |
| 9 | InstallmentAmount | decimal(18,4) | Y |  |  |
| 10 | Description | nvarchar(2048) | Y |  |  |
| 11 | Value1 | nvarchar(2048) | Y |  |  |
| 12 | Value2 | nvarchar(2048) | Y |  |  |
| 13 | Value3 | nvarchar(2048) | Y |  |  |
| 14 | CloseDate | date | Y |  |  |
| 15 | CloseType | tinyint | Y |  |  |
| 16 | State | tinyint | N | ((0)) |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | Version | int | N |  |  |
| 22 | ConfirmationRequestID | int | Y |  |  |
| 23 | ConfirmationStatus | tinyint | N | ((1)) |  |

- **Primary key:** ConfirmationID
- **FK** `FK_Confirmation_ConfirmationType` (ConfirmationTypeID) -> HRM.ConfirmationType (ConfirmationTypeID)
- **FK** `FK_Confirmation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Confirmation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Confirmation_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### HRM.ConfirmationForm

Rows: 0 | ماهیت گواهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmationFormID | tinyint | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | ParameterID | int | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ConfirmationFormID
- **FK** `FK_ConfirmationForm_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmationForm_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.ConfirmationType (ConfirmationFormID); HRM.PaymentSystemCalculationMethod (ConfirmationFormID)

### HRM.ConfirmationType

Rows: 0 | نوع گواهی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmationTypeID | int | N |  | identity |
| 2 | ConfirmationFormID | tinyint | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | HasReciver | bit | N |  |  |
| 6 | HasAmount | bit | N |  |  |
| 7 | HasInstallmentAmount | bit | N |  |  |
| 8 | HasDescription | bit | N |  |  |
| 9 | HasReciverPerson | bit | N |  |  |
| 10 | HasValue1 | bit | N |  |  |
| 11 | HasValue2 | bit | N |  |  |
| 12 | HasValue3 | bit | N |  |  |
| 13 | SaturnReportID | int | Y |  |  |
| 14 | FromNumber | int | N | ((1)) |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |

- **Primary key:** ConfirmationTypeID
- **FK** `FK_ConfirmationType_ConfirmationForm` (ConfirmationFormID) -> HRM.ConfirmationForm (ConfirmationFormID)
- **FK** `FK_ConfirmationType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmationType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConfirmationType_SaturnReport` (SaturnReportID) -> CFG.SaturnReport (ReportID)
- **Referenced by:** HRM.Confirmation (ConfirmationTypeID); REQ.ConfirmationRequest (ConfirmationTypeID)

### HRM.CostRegistration

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostRegistrationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | ConfirmDate | date | Y |  |  |
| 5 | MyCost | bit | N |  |  |
| 6 | BaseType | tinyint | N |  |  |
| 7 | Status | tinyint | N | ((1)) |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostRegistrationID
- **FK** `FK_CostRegistration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostRegistration_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.CostRegistrationItem (CostRegistrationID)

### HRM.CostRegistrationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostRegistrationItemID | int | N |  | identity |
| 2 | CostRegistrationID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | MissionRequestID | int | Y |  |  |
| 7 | StaffCostID | int | N |  |  |
| 8 | Amount | decimal(36,10) | N |  |  |
| 9 | ConfirmedAmount | decimal(36,10) | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostRegistrationItemID
- **FK** `FK_CostRegistrationItem_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_CostRegistrationItem_StaffCost` (StaffCostID) -> HRM.StaffCost (StaffCostID)
- **FK** `FK_CostRegistrationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostRegistrationItem_MissionRequest` (MissionRequestID) -> ATN.MissionRequest (MissionRequestID)
- **FK** `FK_CostRegistrationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostRegistrationItem_CostRegistration` (CostRegistrationID) -> HRM.CostRegistration (CostRegistrationID) on delete CASCADE

### HRM.Education

Rows: 65 | تحصیلات پرسنل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EducationID | int | N |  | identity |
| 2 | Skill | bit | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | InstituteID | int | N |  |  |
| 5 | StudyDegreeID | tinyint | Y |  |  |
| 6 | StudyFieldID | int | Y |  |  |
| 7 | StartDate | date | Y |  |  |
| 8 | EndDate | date | Y |  |  |
| 9 | Average | decimal(5,2) | Y |  |  |
| 10 | CertificateTypeID | int | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EducationID
- **index** `NonClusteredIndex-20170912-132105` (PersonelID)
- **FK** `FK_Education_CertificateType` (CertificateTypeID) -> HRM.CertificateType (CertificateTypeID)
- **FK** `FK_Education_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Education_Institue` (InstituteID) -> HRM.Institue (InstitueID)
- **FK** `FK_Education_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Education_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE
- **FK** `FK_Education_StudyDegree` (StudyDegreeID) -> HRM.StudyDegree (StudyDegreeID)
- **FK** `FK_Education_StudyField` (StudyFieldID) -> HRM.StudyField (StudyFieldID)

### HRM.EmployerShare

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmployerShareID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | Level | tinyint | N |  |  |
| 4 | Type | tinyint | N |  |  |
| 5 | Amount | decimal(30,10) | N |  |  |
| 6 | FoodTypeID | int | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EmployerShareID
- **FK** `FK_EmployerShare_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_EmployerShare_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_EmployerShare_FoodType` (FoodTypeID) -> HRM.FoodType (FoodTypeID)

### HRM.EmploymentRequest

Rows: 0 | درخواست جذب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmploymentRequestID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | OrganizationUnitID | int | N |  |  |
| 5 | JobID | int | N |  |  |
| 6 | RequiredQuantity | int | N | ((1)) |  |
| 7 | Status | tinyint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** EmploymentRequestID
- **FK** `FK_EmploymentRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_EmploymentRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_EmploymentRequest_Job` (JobID) -> HRM.Job (JobID)
- **FK** `FK_EmploymentRequest_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** HRM.EmploymentRequestCV (EmploymentRequestID)

### HRM.EmploymentRequestCV

Rows: 0 | دریافت رزومه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmploymentRequestCVID | int | N |  | identity |
| 2 | EmploymentRequestID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | FirstName | nvarchar(100) | N |  |  |
| 6 | LastName | nvarchar(100) | N |  |  |
| 7 | CVFile | varbinary(MAX) | Y |  |  |
| 8 | Status | tinyint | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** EmploymentRequestCVID
- **FK** `FK_EmploymentRequestCV_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_EmploymentRequestCV_EmploymentRequest` (EmploymentRequestID) -> HRM.EmploymentRequest (EmploymentRequestID)
- **FK** `FK_EmploymentRequestCV_Creator` (Creator) -> CFG.User (UserID)

### HRM.EmploymentStatus

Rows: 1 | وضعیت استخدام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmploymentStatusID | tinyint | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** EmploymentStatusID
- **FK** `FK_EmploymentStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EmploymentStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Agreement (EmploymentStatusID); HRM.EmploymentTypeEmploymentStatus (EmploymentStatusID)

### HRM.EmploymentType

Rows: 1 | نوع استخدام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmploymentTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | PaymentSystemID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EmploymentTypeID
- **unique index** `IX_EmploymentType_Code` (Code)
- **FK** `FK_EmploymentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EmploymentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_EmploymentType_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **Referenced by:** EDU.CoursePlaningConditionEmploymentType (EmploymentTypeID); HRM.Agreement (EmploymentTypeID); HRM.EmploymentTypeEmploymentStatus (EmploymentTypeID); PAY.CalculationAggregateParameter (EmploymentTypeID); PAY.CalculationMethod (EmploymentTypeID); PAY.ParameterMonthlyDataFilterEmploymentType (EmploymentTypeID)

### HRM.EmploymentTypeEmploymentStatus

Rows: 0 | ارتباط نوع استخدام با وضوعیت استخدام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EmploymentTypeEmploymentStatusID | int | N |  | identity |
| 2 | EmploymentTypeID | int | N |  |  |
| 3 | EmploymentStatusID | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** EmploymentTypeEmploymentStatusID
- **FK** `FK_EmploymentTypeEmploymentStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EmploymentTypeEmploymentStatus_EmploymentStatus` (EmploymentStatusID) -> HRM.EmploymentStatus (EmploymentStatusID)
- **FK** `FK_EmploymentTypeEmploymentStatus_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID)
- **FK** `FK_EmploymentTypeEmploymentStatus_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.EndReason

Rows: 0 | دلیل خاتمه خدمت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EndReasonID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** EndReasonID
- **FK** `FK_EndReason_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EndReason_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Experience (EndReasonID)

### HRM.Experience

Rows: 0 | تجربه پرسنل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ExperienceID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | CompanyName | nvarchar(250) | N |  |  |
| 4 | WorkPositionID | int | Y |  |  |
| 5 | StartDate | date | Y |  |  |
| 6 | EndDate | date | Y |  |  |
| 7 | EndReasonID | int | Y |  |  |
| 8 | History | decimal(30,4) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ExperienceID
- **FK** `FK_Experience_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Experience_EndReason` (EndReasonID) -> HRM.EndReason (EndReasonID)
- **FK** `FK_Experience_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Experience_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE
- **FK** `FK_Experience_WorkPosition` (WorkPositionID) -> HRM.WorkPosition (WorkPositionID)

### HRM.FlowChart

Rows: 1 | ساختار سازمانی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FlowChartID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** FlowChartID
- **FK** `FK_FlowChart_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FlowChart_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FlowChart_Parent` (ParentID) -> HRM.FlowChart (FlowChartID)
- **FK** `FK_FlowChart_Company` (CompanyID) -> CFG.Company (CompanyID)
- **Referenced by:** CFG.OrganizationUnit (FlowChartID); EDU.CoursePlaningConditionFlowChart (FlowChartID); HRM.FlowChart (ParentID); HRM.Position (FlowChartID)

### HRM.Food

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodID | int | N |  | identity |
| 2 | Code | nvarchar(50) | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | FoodTypeID | int | N |  |  |

- **Primary key:** FoodID
- **FK** `FK_Food_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Food_FoodType` (FoodTypeID) -> HRM.FoodType (FoodTypeID)
- **FK** `FK_Food_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.FoodOrderItem (FoodID); HRM.FoodPlanItem (FoodID); HRM.FoodPrice (FoodID)

### HRM.FoodOrder

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodOrderID | int | N |  | identity |
| 2 | Version | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | ServingPlaceID | int | N |  |  |
| 9 | Type | tinyint | N |  |  |
| 10 | PersonnelID | int | Y |  |  |
| 11 | PartyID | bigint | Y |  |  |

- **Primary key:** FoodOrderID
- **FK** `FK_FoodOrder_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_FoodOrder_ServingPlace` (ServingPlaceID) -> HRM.ServingPlace (ServingPlaceID)
- **FK** `FK_FoodOrder_Personnel` (PersonnelID) -> HRM.Personel (PersonelID)
- **FK** `FK_FoodOrder_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodOrder_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.FoodOrderItem (FoodOrderID)

### HRM.FoodOrderItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodOrderItemID | int | N |  | identity |
| 2 | FoodOrderID | int | N |  |  |
| 3 | FoodID | int | N |  |  |
| 4 | PartyID | bigint | N |  |  |
| 5 | Quantity | int | N |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Description | nvarchar(500) | Y |  |  |
| 13 | Description2 | nvarchar(500) | Y |  |  |

- **Primary key:** FoodOrderItemID
- **FK** `FK_FoodOrderItem_FoodOrder` (FoodOrderID) -> HRM.FoodOrder (FoodOrderID) on delete CASCADE
- **FK** `FK_FoodOrderItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodOrderItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FoodOrderItem_Food` (FoodID) -> HRM.Food (FoodID)
- **FK** `FK_FoodOrderItem_Party` (PartyID) -> CFG.Party (PartyID)

### HRM.FoodPlan

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodPlanID | int | N |  | identity |
| 2 | ServingPlaceID | int | N |  |  |
| 3 | DATE | date | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FoodPlanID
- **FK** `FK_FoodPlan_ServingPlace` (ServingPlaceID) -> HRM.ServingPlace (ServingPlaceID)
- **FK** `FK_FoodPlan_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodPlan_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.FoodPlanItem (FoodPlanID)

### HRM.FoodPlanItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodPlanItemID | int | N |  | identity |
| 2 | FoodPlanID | int | N |  |  |
| 3 | FoodID | int | N |  |  |
| 4 | PartyID | bigint | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FoodPlanItemID
- **FK** `FK_FoodPlanItem_FoodPlan` (FoodPlanID) -> HRM.FoodPlan (FoodPlanID) on delete CASCADE
- **FK** `FK_FoodPlanItem_Food` (FoodID) -> HRM.Food (FoodID)
- **FK** `FK_FoodPlanItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_FoodPlanItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodPlanItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.FoodPrice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodPriceID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | ServingPlaceID | int | N |  |  |
| 4 | FoodID | int | N |  |  |
| 5 | Amount | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | PartyID | bigint | Y |  |  |

- **Primary key:** FoodPriceID
- **FK** `FK_FoodPrice_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_FoodPrice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodPrice_Food` (FoodID) -> HRM.Food (FoodID)
- **FK** `FK_FoodPrice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FoodPrice_ServingPlace` (ServingPlaceID) -> HRM.ServingPlace (ServingPlaceID)

### HRM.FoodType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodTypeID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | NeededPlan | bit | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FoodTypeID
- **FK** `FK_FoodType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.EmployerShare (FoodTypeID); HRM.Food (FoodTypeID); HRM.FoodTypeItem (FoodTypeID)

### HRM.FoodTypeItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FoodTypeItemID | int | N |  | identity |
| 2 | FoodTypeID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | HasOrderLimit | bit | N |  |  |
| 5 | HasEmployerShare | bit | N |  |  |
| 6 | EmployerShareType | tinyint | Y |  |  |
| 7 | EmployerShareValue | decimal(30,4) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FoodTypeItemID
- **FK** `FK_FoodTypeItem_FoodType` (FoodTypeID) -> HRM.FoodType (FoodTypeID) on delete CASCADE
- **FK** `FK_FoodTypeItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FoodTypeItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.Institue

Rows: 3 | دانشگاه/موسسه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstitueID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** InstitueID
- **FK** `FK_Institue_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Institue_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Education (InstituteID)

### HRM.Job

Rows: 63 | شغل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JobID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Code | nvarchar(50) | Y |  |  |
| 5 | group | tinyint | N |  |  |
| 6 | InsuranceCode | nvarchar(250) | Y |  |  |
| 7 | JobSpecification | nvarchar(MAX) | Y |  |  |
| 8 | JobSpecification2 | nvarchar(MAX) | Y |  |  |
| 9 | OccupationGradeID | int | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | SpecialSkills | nvarchar(MAX) | Y |  |  |
| 16 | SpecialSkills2 | nvarchar(MAX) | Y |  |  |
| 17 | IndividualCharacteristics | nvarchar(MAX) | Y |  |  |
| 18 | IndividualCharacteristics2 | nvarchar(MAX) | Y |  |  |

- **Primary key:** JobID
- **FK** `FK_Job_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Job_JobGroup` (group) -> HRM.JobGroup (JobGroupID)
- **FK** `FK_Job_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Job_OccupationGrade` (OccupationGradeID) -> HRM.OccupationGrade (OccupationGradeID)
- **Referenced by:** EDU.CoursePlaningConditionJob (JobID); HRM.Agreement (JobID); HRM.EmploymentRequest (JobID); HRM.PositionJob (JobID)

### HRM.JobGroup

Rows: 19 | گروه شغل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JobGroupID | tinyint | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Code | nvarchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** JobGroupID
- **FK** `FK_JobGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_JobGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.BaseValueData (JobGroupID); HRM.Job (group)

### HRM.OccupationGrade

Rows: 0 | رتبه شغلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OccupationGradeID | int | N |  | identity |
| 2 | PaymentSystemID | int | N |  |  |
| 3 | Code | varchar(50) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Value | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** OccupationGradeID
- **unique index** `IX_OccupationGrade` (PaymentSystemID, Title)
- **unique index** `IX_OccupationGrade_1` (PaymentSystemID, Code)
- **FK** `FK_OccupationGrade_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OccupationGrade_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OccupationGrade_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **Referenced by:** HRM.Agreement (OccupationGradeID); HRM.Job (OccupationGradeID)

### HRM.Organization

Rows: 3 | سازمان ذینفع

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrganizationID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** OrganizationID
- **FK** `FK_Organization_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Organization_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.OrganizationItem (OrganizationID); HRM.TaxTableType (OrganizationID); PAY.Parameter (OrganizationID); PAY.PayrollFile (OrganizationID); PAY.PayrollPaymentType (OrganizationID)

### HRM.OrganizationItem

Rows: 14 | قلم سازمان ذینفع

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrganizationItemID | int | N |  | identity |
| 2 | OrganizationID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | FileNumber | nvarchar(100) | N |  |  |
| 5 | AgreementRow | nvarchar(100) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Address | nvarchar(2048) | Y |  |  |
| 12 | Employer | nvarchar(512) | Y |  |  |
| 13 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** OrganizationItemID
- **FK** `FK_OrganizationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrganizationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrganizationItem_Organization` (OrganizationID) -> HRM.Organization (OrganizationID) on delete CASCADE
- **FK** `FK_OrganizationItem_PartyID` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_OrganizationItem_Company` (CompanyID) -> CFG.Company (CompanyID)
- **Referenced by:** HRM.AgreementOrganization (OrganizationItemID); PAY.Loan (OrganizationItemID); PAY.PayPreparing (OrganizationItemID)

### HRM.OtherPersonnelInformation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OtherPersonnelInformationID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | AttendanceParameterID | int | N |  |  |
| 4 | Value | decimal(36,10) | N |  |  |
| 5 | FromDate | datetime | Y |  |  |
| 6 | ToDate | datetime | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** OtherPersonnelInformationID
- **FK** `FK_OtherPersonnelInformation_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_OtherPersonnelInformation_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)
- **FK** `FK_OtherPersonnelInformation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OtherPersonnelInformation_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.PaymentSystem

Rows: 0 | نظام پرداخت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSystemID | int | N |  | identity |
| 2 | Code | varchar(50) | N |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Title2 | nvarchar(512) | N |  |  |
| 5 | HasGroup | bit | N |  |  |
| 6 | HasBase | bit | N |  |  |
| 7 | HasOccupationGrade | bit | N |  |  |
| 8 | OccupationGradeType | tinyint | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** PaymentSystemID
- **unique index** `IX_PaymentSystem_Code` (Code)
- **FK** `FK_PaymentSystem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentSystem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementTypeInterpretation (PaymentSystemID); HRM.BaseValueData (PaymentSystemID); HRM.BaseValuePaymentSystem (PaymentSystemID); HRM.EmploymentType (PaymentSystemID); HRM.OccupationGrade (PaymentSystemID); HRM.PaymentSystemCalculationMethod (PaymentSystemID); HRM.PayrollBase (PaymentSystemID); HRM.PayrollGroup (PaymentSystemID)

### HRM.PaymentSystemCalculationMethod

Rows: 0 | روش محاسبه عامل(نظام پرداخت)

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSystemCalculationMethodID | int | N |  | identity |
| 2 | ParameterID | int | Y |  |  |
| 3 | PaymentSystemID | int | Y |  |  |
| 4 | EfficientCalendarMonthID | int | N |  |  |
| 5 | GenerateCalendarMonthID | int | N |  |  |
| 6 | ConfirmationFormID | tinyint | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** PaymentSystemCalculationMethodID
- **FK** `FK_PaymentSystemCalculationMethod_CalendarMonth` (EfficientCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PaymentSystemCalculationMethod_CalendarMonth1` (GenerateCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PaymentSystemCalculationMethod_ConfirmationForm` (ConfirmationFormID) -> HRM.ConfirmationForm (ConfirmationFormID) on delete CASCADE
- **FK** `FK_PaymentSystemCalculationMethod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemCalculationMethod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemCalculationMethod_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_PaymentSystemCalculationMethod_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **Referenced by:** HRM.PaymentSystemFormula (PaymentSystemCalculationMethodID)

### HRM.PaymentSystemFormula

Rows: 0 | فرمول نظام پرداخت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSystemFormulaID | int | N |  | identity |
| 2 | PaymentSystemCalculationMethodID | int | N |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Expression | varchar(MAX) | N |  |  |
| 5 | Condition | varchar(MAX) | Y |  |  |
| 6 | SQLExpression | nvarchar(MAX) | Y |  |  |
| 7 | SQLCondition | nvarchar(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentSystemFormulaID
- **FK** `FK_PaymentSystemFormula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemFormula_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemFormula_PaymentSystemCalculationMethod` (PaymentSystemCalculationMethodID) -> HRM.PaymentSystemCalculationMethod (PaymentSystemCalculationMethodID) on delete CASCADE
- **Referenced by:** HRM.PaymentSystemFormulaParameter (PaymentSystemFormulaID)

### HRM.PaymentSystemFormulaParameter

Rows: 0 | عامل های فرمول نظام پرداخت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSystemFormulaParameterID | int | N |  | identity |
| 2 | PaymentSystemFormulaID | int | N |  |  |
| 3 | ParameterID | int | Y |  |  |
| 4 | ParameterValueTypeID | int | Y |  |  |
| 5 | CalculationAggregateFunctionID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentSystemFormulaParameterID
- **FK** `FK_PaymentSystemFormulaParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemFormulaParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentSystemFormulaParameter_PaymentSystemFormula` (PaymentSystemFormulaID) -> HRM.PaymentSystemFormula (PaymentSystemFormulaID) on delete CASCADE

### HRM.PaymentTopic

Rows: 1 | موضوع پرداخت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentTopicID | tinyint | N |  | identity |
| 2 | Title | nvarchar(128) | N |  |  |
| 3 | Title2 | nvarchar(128) | N |  |  |
| 4 | EngName | nvarchar(50) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentTopicID
- **FK** `FK_PaymentTopic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentTopic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.PersonelAccount (PaymentTopicID); PAY.PayrollFile (PaymentTopicID)

### HRM.PayrollBase

Rows: 0 | پایه شغلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollBaseID | int | N |  | identity |
| 2 | PaymentSystemID | int | N |  |  |
| 3 | Code | varchar(50) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Value | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** PayrollBaseID
- **unique index** `IX_PayrollBase` (PaymentSystemID, Title)
- **unique index** `IX_PayrollBase_1` (PaymentSystemID, Code)
- **FK** `FK_PayrollBase_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollBase_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollBase_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **Referenced by:** HRM.Agreement (PayrollBaseID)

### HRM.PayrollGroup

Rows: 0 | گروه شغلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollGroupID | int | N |  | identity |
| 2 | PaymentSystemID | int | N |  |  |
| 3 | Code | varchar(50) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Value | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** PayrollGroupID
- **unique index** `IX_PayrollGroup` (PaymentSystemID, Title)
- **unique index** `IX_PayrollGroup_1` (PaymentSystemID, Code)
- **FK** `FK_PayrollGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollGroup_PaymentSystem` (PaymentSystemID) -> HRM.PaymentSystem (PaymentSystemID)
- **Referenced by:** HRM.Agreement (PayrollGroupID)

### HRM.Personel

Rows: 380

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelID | int | N |  | identity |
| 2 | PartyID | bigint | N |  |  |
| 3 | Code | nvarchar(100) | N |  |  |
| 4 | BirthCertificateNumber | nvarchar(100) | N |  |  |
| 5 | BirthCertificateDate | date | Y |  |  |
| 6 | FatherName | nvarchar(100) | N |  |  |
| 7 | Birthday | date | Y |  |  |
| 8 | InsuranceNumber | nvarchar(100) | Y |  |  |
| 9 | Sex | tinyint | N |  |  |
| 10 | MarriageStatus | tinyint | N |  |  |
| 11 | MarriageDate | date | Y |  |  |
| 12 | ExemptionCause | tinyint | Y |  |  |
| 13 | Blood | tinyint | Y |  |  |
| 14 | Disease | bit | N |  |  |
| 15 | DiseaseDescriptopn | nvarchar(500) | Y |  |  |
| 16 | ResidenceType | tinyint | Y |  |  |
| 17 | TaxExempt | bit | N |  |  |
| 18 | TaxExemptionCause | int | Y |  |  |
| 19 | InsuranceType | tinyint | Y |  |  |
| 20 | BirthLocationID | int | Y |  |  |
| 21 | IssueLocationID | int | Y |  |  |
| 22 | Version | int | N |  |  |
| 23 | Creator | int | N |  |  |
| 24 | CreationDate | datetime | N |  |  |
| 25 | LastEditor | int | N |  |  |
| 26 | LastEditionDate | datetime | N |  |  |
| 27 | FatherName2 | nvarchar(100) | N |  |  |
| 28 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** PersonelID
- **unique index** `IX_Code_CompanyID` (Code, CompanyID)
- **FK** `FK_Personel_Company` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_Personel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Personel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Personel_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** ATN.AttendanceCalculationPersonnel (PersonelID); ATN.AttendanceChangeRequest (PersonelID); ATN.EntryAndExit (PersonelID); ATN.GroupAssignment (PersonelID); ATN.JustificationRegistration (PersonelID); ATN.LeaveRequest (PersonelID); ATN.MissionReport (PersonelID); ATN.MissionRequest (PersonelID); ATN.PersonelAttendanceDevice (PersonelID); ATN.PersonelRequest (PersonelID); ATN.PersonnelShiftAssignmentItem (PersonelID); ATN.VacancyEdition (PersonelID); ATN.VacancyEstablishment (PersonelID); ATN.VacancyTypeAssignmentItem (PersonelID); HRM.Agreement (PersonelID); HRM.ChangePersonelStatus1 (PersonelID); HRM.Confirmation (PersonelID); HRM.CostRegistrationItem (PersonelID); HRM.Education (PersonelID); HRM.Experience (PersonelID); HRM.FoodOrder (PersonnelID); HRM.OtherPersonnelInformation (PersonelID); HRM.PersonelAccount (PersonelID); HRM.PersonelDedication (PersonelID); HRM.PersonelFile (PersonelID); HRM.PersonelMarriageStatus (PersonelID); HRM.Relative (PersonelID); PAY.CalculationPersonel (PersonelID); PAY.Establishment (PersonnelID); PAY.Loan (PersonelID); PAY.ParameterConstantData (PersonnelID); PAY.ParameterMonthlyData (PersonnelID); PAY.PayPreparingItem (PersonnelID); PAY.PersonelVoucherSetting (PersonelID); PAY.TimeSheet (PersonelID); REQ.AdvancePaymentRequest (PersonelID); REQ.ConfirmationRequest (PersonelID); REQ.LoanRequest (PersonelID)

### HRM.PersonelAccount

Rows: 78 | حساب بانکی کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelAccountID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | BankBranchID | int | N |  | شناسه شعبه – مرتبط با جدول BankBranch |
| 4 | AccountNumber | nvarchar(250) | N |  |  |
| 5 | BankAccountTypeID | int | N |  |  |
| 6 | PaymentTopicID | tinyint | N | ((1)) |  |
| 7 | Date | date | N | (getdate()) |  |
| 8 | Creator | int | N |  | تاريخ تعريف نوع حساب  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** PersonelAccountID
- **FK** `FK_PersonelAccount_BankAccountType` (BankAccountTypeID) -> CFG.BankAccountType (BankAccountTypeID)
- **FK** `FK_PersonelAccount_BankBranch` (BankBranchID) -> CFG.BankBranch (BankBranchID)
- **FK** `FK_PersonelAccount_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelAccount_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelAccount_PaymentTopic` (PaymentTopicID) -> HRM.PaymentTopic (PaymentTopicID)
- **FK** `FK_PersonelAccount_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE

### HRM.PersonelDedication

Rows: 0 | ایثارگری کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelDedicationID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | DedicationType | tinyint | N |  |  |
| 4 | FromDate | date | Y |  |  |
| 5 | ToDate | date | Y |  |  |
| 6 | Amount | decimal(18,5) | Y |  |  |
| 7 | ApplyDate | date | N | (getdate()) |  |
| 8 | Creator | int | N |  | تاريخ تعريف نوع حساب  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** PersonelDedicationID
- **index** `NonClusteredIndex-20170912-132042` (PersonelID)
- **FK** `FK_PersonelDedication_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelDedication_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelDedication_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE

### HRM.PersonelFile

Rows: 3 | تصویر کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelID | int | N |  |  |
| 2 | Image | image | Y |  |  |
| 3 | Signature | image | Y |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PersonelID
- **FK** `FK_PersonelFile_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelFile_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelFile_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE

### HRM.PersonelMarriageStatus

Rows: 2 | وضعیت تاهل کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelMarriageStatusID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | MarriageStatus | tinyint | N |  |  |
| 4 | ApplyDate | date | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PersonelMarriageStatusID
- **FK** `FK_PersonelMarriageStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelMarriageStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelMarriageStatus_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE

### HRM.PersonelStatus

Rows: 5 | وضعیت کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelStatusID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | N |  |  |
| 5 | StatusType | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PersonelStatusID
- **FK** `FK_PersonelStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementType (PrePersonelStatusID); HRM.AgreementTypePrePersonelStatus (PersonelStatusID)

### HRM.Position

Rows: 8 | پست سازمانی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PositionID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Code | nvarchar(50) | Y |  |  |
| 5 | FlowChartID | int | N |  |  |
| 6 | Specification | nvarchar(MAX) | Y |  |  |
| 7 | Specification2 | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | IsManagerToFlowChart | bit | N | ((0)) |  |

- **Primary key:** PositionID
- **FK** `FK_Position_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Position_FlowChart` (FlowChartID) -> HRM.FlowChart (FlowChartID)
- **FK** `FK_Position_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CoursePlaningConditionPosition (PositionID); HRM.Agreement (PositionID); HRM.PositionJob (PositionID)

### HRM.PositionJob

Rows: 2 | ارتباط شغل-پست سازمانی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PositionJobID | int | N |  | identity |
| 2 | PositionID | int | N |  |  |
| 3 | JobID | int | N |  |  |
| 4 | Vacancy | smallint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** PositionJobID
- **FK** `FK_PositionJob_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PositionJob_Job` (JobID) -> HRM.Job (JobID)
- **FK** `FK_PositionJob_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PositionJob_Position` (PositionID) -> HRM.Position (PositionID) on delete CASCADE

### HRM.Relative

Rows: 0 | وابسته کارمند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RelativeID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | FirstName | nvarchar(250) | N |  |  |
| 4 | LastName | nvarchar(250) | N |  |  |
| 5 | Birthday | datetime | Y |  |  |
| 6 | BirthCertificateNumber | nvarchar(100) | Y |  |  |
| 7 | IdentificationCode | nvarchar(100) | Y |  |  |
| 8 | StudyDegreeID | tinyint | Y |  |  |
| 9 | Relation | tinyint | Y |  |  |
| 10 | IsSponsored | bit | N |  |  |
| 11 | Sex | tinyint | Y |  |  |
| 12 | SponsorshipStartDate | date | Y |  |  |
| 13 | SponsorshipEndDate | date | Y |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RelativeID
- **index** `NonClusteredIndex-20170912-132130` (PersonelID)
- **FK** `FK_Relative_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Relative_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Relative_Personel` (PersonelID) -> HRM.Personel (PersonelID) on delete CASCADE
- **FK** `FK_Relative_StudyDegree` (StudyDegreeID) -> HRM.StudyDegree (StudyDegreeID)

### HRM.ServingPlace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ServingPlaceID | int | N |  | identity |
| 2 | Code | nvarchar(50) | Y |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | OrderLimitationTime | decimal(18,0) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ServingPlaceID
- **FK** `FK_ServingPlace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ServingPlace_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** HRM.FoodOrder (ServingPlaceID); HRM.FoodPlan (ServingPlaceID); HRM.FoodPrice (ServingPlaceID)

### HRM.StaffCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StaffCostID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | Y |  |  |
| 4 | EffectiveInPayrollCalculation | bit | N |  |  |
| 5 | ParameterID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StaffCostID
- **FK** `FK_StaffCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StaffCost_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** HRM.CostRegistrationItem (StaffCostID)

### HRM.StudyDegree

Rows: 8 | مدرک تحصیلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StudyDegreeID | tinyint | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StudyDegreeID
- **FK** `FK_StudyDegree_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StudyDegree_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CoursePlaningConditionStudyDegree (StudyDegreeID); HRM.Education (StudyDegreeID); HRM.Relative (StudyDegreeID)

### HRM.StudyField

Rows: 24 | رشته تحصیلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StudyFieldID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** StudyFieldID
- **FK** `FK_StudyField_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StudyField_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CoursePlaningConditionStudyField (StudyFieldID); HRM.Education (StudyFieldID)

### HRM.TaxTable

Rows: 9 | جدول مالیاتی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxTableID | int | N |  | identity |
| 2 | TaxTableTypeID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TaxTableID
- **FK** `FK_TaxTable_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_TaxTable_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TaxTable_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TaxTable_TaxTableType` (TaxTableTypeID) -> HRM.TaxTableType (TaxTableTypeID)
- **Referenced by:** HRM.TaxTableItem (TaxTableID)

### HRM.TaxTableItem

Rows: 48 | قلم جدول مالیاتی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxTableItemID | int | N |  | identity |
| 2 | TaxTableID | int | N |  |  |
| 3 | From | decimal(30,4) | N |  |  |
| 4 | Up | decimal(30,4) | N |  |  |
| 5 | Rate | decimal(5,2) | N |  |  |
| 6 | AmountInLimit | decimal(30,4) | N |  |  |
| 7 | TotalAmount | decimal(30,4) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TaxTableItemID
- **FK** `FK_TaxTableItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TaxTableItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TaxTableItem_TaxTable` (TaxTableID) -> HRM.TaxTable (TaxTableID) on delete CASCADE

### HRM.TaxTableType

Rows: 4

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxTableTypeID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | OrganizationID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TaxTableTypeID
- **FK** `FK_TaxTableType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TaxTableType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TaxTableType_Organization` (OrganizationID) -> HRM.Organization (OrganizationID)
- **Referenced by:** HRM.AgreementOrganization (TaxTableTypeID); HRM.TaxTable (TaxTableTypeID)

### HRM.Vacation

Rows: 1 | مرخصی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacationID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | DataEntryType | tinyint | N |  |  |
| 5 | HasEstablishment | bit | N |  |  |
| 6 | CheckNegativeRemain | bit | N |  |  |
| 7 | HasRedemption | bit | N |  |  |
| 8 | RemainParameterID | int | N |  |  |
| 9 | ValueParameterID | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** VacationID
- **FK** `FK_Vacation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Vacation_LastEditor` (LastEditor) -> CFG.User (UserID)

### HRM.WorkPlace

Rows: 9 | محل خدمت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkPlaceID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** WorkPlaceID
- **FK** `FK_WorkPlace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkPlace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Agreement (WorkPlaceID)

### HRM.WorkPosition

Rows: 0 | سمت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkPositionID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** WorkPositionID
- **FK** `FK_WorkPosition_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkPosition_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.Experience (WorkPositionID)

## Views

### HRM.CalendarMonthPersonelAgreement

Definition: `programmability/views/HRM.CalendarMonthPersonelAgreement.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | Y |
| 2 | CalendarMonthID | int | N |
| 3 | AgreementID | int | Y |

### HRM.CalendarMonthPersonelStatus

Definition: `programmability/views/HRM.CalendarMonthPersonelStatus.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | Y |
| 2 | CalendarMonthID | int | N |
| 3 | STATUS | tinyint | Y |

### HRM.CalendarMonthPersonelStatusAtAnyDay

Definition: `programmability/views/HRM.CalendarMonthPersonelStatusAtAnyDay.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | CalendarMonthID | int | N |
| 3 | STATUS | int | N |

### HRM.CalendarMonthPersonelVoucherSetting

Definition: `programmability/views/HRM.CalendarMonthPersonelVoucherSetting.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | Y |
| 2 | CalendarMonthID | int | N |
| 3 | PersonelVoucherSettingID | int | Y |
| 4 | PayrollAccGroupID | tinyint | Y |

### HRM.ChangePersonelStatus

Definition: `programmability/views/HRM.ChangePersonelStatus.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | ChangeDate | date | N |
| 3 | STATUS | tinyint | N |
| 4 | IssueDate | date | Y |
| 5 | AgreementID | int | N |

### HRM.vwAgreementType

Definition: `programmability/views/HRM.vwAgreementType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AgreementTypeID | tinyint | N |
| 2 | AgreementTypeFormID | tinyint | Y |
| 3 | Title | nvarchar(512) | N |
| 4 | Code | varchar(50) | N |
| 5 | PrePersonelStatusID | int | Y |
| 6 | NeedConfirmation | bit | N |
| 7 | IsStart | bit | Y |
| 8 | isEnd | bit | Y |

### HRM.vwCalendarMonth

Definition: `programmability/views/HRM.vwCalendarMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | YearMonth | nvarchar(7) | Y |
| 2 | CalendarID | int | N |
| 3 | CalendarMonthID | int | N |
| 4 | Year | smallint | N |
| 5 | MonthNumber | tinyint | N |
| 6 | MonthName | nvarchar(100) | N |
| 7 | StartDate | date | N |
| 8 | EndDate | date | N |
| 9 | WorkHours | decimal(18,0) | N |
| 10 | StandardDays | tinyint | N |
| 11 | PermittedDays | tinyint | N |
| 12 | StandardHours | int | N |
| 13 | PermittedHours | int | N |

### HRM.VwDedication

Definition: `programmability/views/HRM.VwDedication.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | PersonelName | nvarchar(256) | N |
| 5 | LastName | nvarchar(256) | Y |
| 6 | FromDate | nvarchar(MAX) | Y |
| 7 | ToDate | nvarchar(MAX) | Y |
| 8 | Amount | decimal(18,5) | Y |
| 9 | DedicationType | nvarchar(12) | Y |

### HRM.vWLastAgreement

Definition: `programmability/views/HRM.vWLastAgreement.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AgreementID | int | N |
| 2 | AgreementTypeID | tinyint | N |
| 3 | ConfirmDate | date | Y |
| 4 | PersonelID | int | N |
| 5 | Number | int | N |
| 6 | IssueDate | date | N |
| 7 | ExecuteDate | date | N |
| 8 | EmploymentDate | date | N |
| 9 | ExpireDate | date | Y |
| 10 | EmploymentTypeID | int | N |
| 11 | EmploymentStatusID | tinyint | Y |
| 12 | WorkPlaceID | int | N |
| 13 | CostCenterID | int | N |
| 14 | PositionID | int | Y |
| 15 | JobID | int | N |
| 16 | Specification | nvarchar(MAX) | Y |
| 17 | Specification2 | nvarchar(MAX) | Y |
| 18 | ConfirmedBy | int | Y |
| 19 | PayrollGroupID | int | Y |
| 20 | PayrollBaseID | int | Y |
| 21 | OccupationGradeID | int | Y |
| 22 | Serial | int | N |
| 23 | IsCorrection | bit | N |
| 24 | ExperienceLen | int | Y |
| 25 | BranchID | int | N |
| 26 | Version | int | N |
| 27 | Creator | int | N |
| 28 | CreationDate | datetime | N |
| 29 | LastEditor | int | N |
| 30 | LastEditionDate | datetime | N |
| 31 | Rno | bigint | Y |

### HRM.vwPaymentTopicAccess

Definition: `programmability/views/HRM.vwPaymentTopicAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | PaymentTopicID | tinyint | N |

### HRM.vwPersonel

Definition: `programmability/views/HRM.vwPersonel.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CompanyID | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | FirstName | nvarchar(256) | N |
| 5 | FirstName2 | nvarchar(256) | N |
| 6 | BirthLocation | nvarchar(256) | Y |
| 7 | BirthLocation2 | nvarchar(256) | Y |
| 8 | BirthLocationID | int | Y |
| 9 | IssueLocationID | int | Y |
| 10 | IssueLocation | nvarchar(256) | Y |
| 11 | IssueLocation2 | nvarchar(256) | Y |
| 12 | LastName | nvarchar(256) | Y |
| 13 | LastName2 | nvarchar(256) | Y |
| 14 | FullName1 | nvarchar(513) | Y |
| 15 | FullName2 | nvarchar(513) | Y |
| 16 | IdentificationCode | nvarchar(50) | Y |
| 17 | InsuranceNumber | nvarchar(100) | Y |
| 18 | BirthCertificateNumber | nvarchar(100) | N |
| 19 | Sex | nvarchar(2048) | Y |
| 20 | Birthday | date | Y |
| 21 | RelationCount | int | Y |
| 22 | ChildCount | int | Y |

### HRM.VwPersonelAccount

Definition: `programmability/views/HRM.VwPersonelAccount.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | PersonelName | nvarchar(256) | N |
| 5 | LastName | nvarchar(256) | Y |
| 6 | BankAccountTypeTitle | nvarchar(256) | N |
| 7 | BankBranchTitle | nvarchar(256) | N |
| 8 | PaymentTopicTitle | nvarchar(128) | N |
| 9 | BankTitle | nvarchar(256) | N |
| 10 | AccountNumber | nvarchar(250) | N |
| 11 | Date | nvarchar(MAX) | Y |

### HRM.VwPersonelEducation

Definition: `programmability/views/HRM.VwPersonelEducation.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | PersonelName | nvarchar(256) | N |
| 5 | LastName | nvarchar(256) | Y |
| 6 | Institute | nvarchar(512) | Y |
| 7 | Field | nvarchar(512) | Y |
| 8 | Average | decimal(4,2) | Y |
| 9 | CertificateType | nvarchar(512) | Y |
| 10 | StartDate | nvarchar(MAX) | Y |
| 11 | EndDate | nvarchar(MAX) | Y |
| 12 | DegreeType | nvarchar(512) | Y |

### HRM.vwPersonelEmplomentDatePerMonth

Definition: `programmability/views/HRM.vwPersonelEmplomentDatePerMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | CalendarMonthID | int | N |
| 3 | StartDate | date | N |
| 4 | EndDate | date | N |
| 5 | AttendanceStartDate | date | Y |
| 6 | AttendanceEndDate | date | Y |
| 7 | EmploymentDate | date | N |
| 8 | PersonelEndDate | date | Y |

### HRM.vwPersonelEmploymenType

Definition: `programmability/views/HRM.vwPersonelEmploymenType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | CalendarMonthID | int | N |
| 3 | EmploymentTypeID | int | N |
| 4 | LastDate | date | N |

### HRM.VwPersonelExperience

Definition: `programmability/views/HRM.VwPersonelExperience.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | PersonelName | nvarchar(256) | N |
| 5 | LastName | nvarchar(256) | Y |
| 6 | CompanyName | nvarchar(250) | N |
| 7 | Position | nvarchar(512) | Y |
| 8 | StartDate | nvarchar(MAX) | Y |
| 9 | EndDate | nvarchar(MAX) | Y |

### HRM.vwPersonelLastAgreementInMonth

Definition: `programmability/views/HRM.vwPersonelLastAgreementInMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | IssueDate | date | N |
| 2 | ExecuteDate | date | N |
| 3 | PersonelID | int | N |
| 4 | EmploymentDate | date | N |
| 5 | EmploymentTypeID | int | N |
| 6 | WorkPlaceID | int | N |
| 7 | CostCenterID | int | N |
| 8 | PositionID | int | Y |
| 9 | JobID | int | N |
| 10 | BranchID | int | N |
| 11 | OrganizationUnitID | int | Y |
| 12 | IsManagerToOrganizationUnit | bit | N |
| 13 | CalendarMonthID | int | N |
| 14 | StartDate | date | N |
| 15 | EndDate | date | N |
| 16 | AttendanceStartDate | date | Y |
| 17 | AttendanceEndDate | date | Y |
| 18 | CostCenterTitle | nvarchar(256) | N |
| 19 | EmploymentTypeTitle | nvarchar(256) | N |
| 20 | PositionTitle | nvarchar(250) | Y |
| 21 | OrganizationUnitTitle | nvarchar(256) | Y |
| 22 | WorkPlaceTitle | nvarchar(250) | N |

### HRM.VwPersonelRelative

Definition: `programmability/views/HRM.VwPersonelRelative.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | PersonelID | int | N |
| 3 | PersonelCode | nvarchar(100) | N |
| 4 | PersonelName | nvarchar(256) | N |
| 5 | LastName | nvarchar(256) | Y |
| 6 | FirstName | nvarchar(250) | N |
| 7 | RLastName | nvarchar(250) | N |
| 8 | BirthCertificateNumber | nvarchar(100) | Y |
| 9 | IsSponsored | bit | N |
| 10 | SponsorshipStartDate | nvarchar(MAX) | Y |
| 11 | SponsorshipEndDate | nvarchar(MAX) | Y |
| 12 | Birthday | nvarchar(MAX) | Y |
| 13 | IdentificationCode | nvarchar(100) | Y |
| 14 | RelationType | varchar(5) | Y |
| 15 | Sex | varchar(4) | Y |

### HRM.vwPersonelStatusInDate

Definition: `programmability/views/HRM.vwPersonelStatusInDate.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | DATE | date | N |
| 3 | PersianFullDateAlternateKey | nvarchar(10) | N |
| 4 | STATUS | tinyint | N |

