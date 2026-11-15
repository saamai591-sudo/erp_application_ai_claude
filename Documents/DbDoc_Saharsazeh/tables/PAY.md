# Schema `PAY`

## Tables

### PAY.CalculationAggregateExpression

Rows: 15 | عبارتهای تجمعی حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationAggregateExpressionID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | AggregateFunc | varchar(50) | N |  |  |
| 5 | CategoryItems | varchar(50) | Y |  |  |
| 6 | ParameterTypeItems | varchar(50) | Y |  |  |
| 7 | IsTaxable | bit | Y |  |  |
| 8 | IsInsuranceable | bit | Y |  |  |
| 9 | ParameterValueTypeItems | varchar(50) | Y |  |  |
| 10 | SqlExpression | varchar(MAX) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculationAggregateExpressionID
- **FK** `FK_CalculationAggregateExpression_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationAggregateExpression_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.FormulaParameter (CalculationAggregateFunctionID)

### PAY.CalculationAggregateParameter

Rows: 132 | پارامترهای مربوط به عبارتهای تجمعی حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationAggregateParameterID | int | N |  | identity |
| 2 | CalculationAggregateExpressionID | int | N |  |  |
| 3 | ParameterID | int | N |  |  |
| 4 | ParameterValueTypeID | int | N |  |  |
| 5 | EmploymentTypeID | int | N |  |  |

- **Primary key:** CalculationAggregateParameterID
- **FK** `FK_CalculationAggregateParameter_Parameter` (ParameterID) -> PAY.Parameter (ParameterID) on delete CASCADE
- **FK** `FK_CalculationAggregateParameter_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID)

### PAY.CalculationBackPayResult

Rows: 161 | ریز محاسبات معوقه حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationBackPayResultID | decimal(18,0) | N |  | identity |
| 2 | ParameterID | int | Y |  |  |
| 3 | ParameterValueTypeID | int | N |  |  |
| 4 | Value | decimal(30,10) | N | ((0)) |  |
| 5 | BackPayValue | decimal(30,10) | N | ((0)) |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | CalculationPersonelID | int | N |  |  |
| 12 | BackPayCalculationPersonelID | int | N |  |  |

- **Primary key:** CalculationBackPayResultID
- **FK** `FK_CalculationBackPayResult_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_CalculationBackPayResult_CalculationPersonel` (CalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID) on delete CASCADE
- **FK** `FK_CalculationBackPayResult_BackPayCalculationPersonel` (BackPayCalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID)

### PAY.CalculationFunction

Rows: 5 | فانکشنهای مورد استفاده در فرمول نویسی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationFunctionID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | ParameterCount | tinyint | N |  |  |
| 5 | SqlExpression | varchar(1024) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculationFunctionID
- **FK** `FK_CalculationFunction_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationFunction_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.CalculationMethod

Rows: 147 | روش محاسبه پارامتر

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationMethodID | int | N |  | identity |
| 2 | ParameterID | int | N |  |  |
| 3 | EmploymentTypeID | int | N |  |  |
| 4 | GenerateCalendarMonthID | int | N |  |  |
| 5 | EfficientCalendarMonthID | int | N |  |  |
| 6 | IsActive | bit | N | ((1)) |  |
| 7 | IsTaxable | bit | N | ((1)) |  |
| 8 | IsInsuranceable | bit | N | ((1)) |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CalculationMethodID
- **FK** `FK_CalculationMethod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationMethod_EfficientCalendarMonth` (EfficientCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_CalculationMethod_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID)
- **FK** `FK_CalculationMethod_GenerateCalendarMonth` (GenerateCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_CalculationMethod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CalculationMethod_Parameter` (ParameterID) -> PAY.Parameter (ParameterID) on delete CASCADE
- **Referenced by:** PAY.Formula (CalculationMethodID)

### PAY.CalculationPersonel

Rows: 6138 | ارتباط جدول محاسبات با پرسنل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationPersonelID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | CalcDate | datetime | Y |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | VoucherID | int | Y |  |  |
| 10 | CalendarMonthID | int | N |  |  |
| 11 | CalculationTypeID | tinyint | N |  |  |
| 12 | FishVisibility | bit | N | ((0)) |  |

- **Primary key:** CalculationPersonelID
- **unique index** `IX_CalculationPersonel` (PersonelID, CalculationTypeID, CalendarMonthID)
- **FK** `FK_CalculationPersonel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationPersonel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CalculationPersonel_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_CalculationPersonel_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete SET_NULL
- **FK** `FK_CalculationPersonel_CalculationTypeID` (CalculationTypeID) -> PAY.CalculationType (CalculationTypeID)
- **FK** `FK_CalculationPersonel_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **Referenced by:** PAY.CalculationBackPayResult (BackPayCalculationPersonelID); PAY.CalculationBackPayResult (CalculationPersonelID); PAY.CalculationResult (CalculationPersonelID); PAY.SettlementCalculation (BaseCalculationPersonelID); PAY.SettlementCalculation (CalculationPersonelID); PAY.TimeSheetCalculationPersonel (CalculationPersonelID); PAY.TimeSheetCalculationResult (CalculationPersonelID)

### PAY.CalculationResult

Rows: 281172 | ریز محاسبات حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationResultID | decimal(18,0) | N |  | identity |
| 2 | ParameterID | int | Y |  |  |
| 3 | ParameterValueTypeID | int | N |  |  |
| 4 | Value | decimal(30,10) | N | ((0)) |  |
| 5 | LoanID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | CalculationPersonelID | int | N |  |  |

- **Primary key:** CalculationResultID
- **FK** `FK_CalculationResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CalculationResult_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_CalculationResult_ParameterValueType` (ParameterValueTypeID) -> PAY.ParameterValueType (ParameterValueTypeID)
- **FK** `FK_CalculationResult_CalculationPersonel` (CalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID) on delete CASCADE
- **Referenced by:** CFG.DebitCreditNoteItem (CalculationResultID); CFG.ManualReceipt (CalculationResultID); FIN.PaymentSubject (CalculationResultID); NOC.CashDataCollection (CalculationResultID)

### PAY.CalculationResult_temp

Rows: 4283 | جدول موقت محاسبات حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationResultID | decimal(18,0) | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | ParameterID | int | Y |  |  |
| 4 | ParameterValueTypeID | int | N |  |  |
| 5 | Value | decimal(30,10) | Y |  |  |
| 6 | EmploymentTypeID | int | N |  |  |
| 7 | LoanID | int | Y |  |  |
| 8 | ParameterFullID | decimal(18,0) | Y |  |  |
| 9 | CalculationPersonelID | int | N |  |  |

- **Primary key:** CalculationResultID
- **index** `_dta_index_CalculationResult_temp_2` (ParameterID, ParameterValueTypeID, PersonelID) include (Value)
- **index** `_dta_index_CalculationResult_temp_3` (ParameterValueTypeID) include (Value)

### PAY.CalculationType

Rows: 7 | نوع محاسبه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationTypeID | tinyint | N |  | identity |
| 2 | Title | nvarchar(128) | N |  |  |
| 3 | Title2 | nvarchar(128) | N |  |  |
| 4 | EngName | varchar(50) | N |  |  |
| 5 | PayTimeType | tinyint | N | ((0)) |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | IsPayable | bit | Y |  |  |
| 12 | IsActive | bit | N | ((1)) |  |

- **Primary key:** CalculationTypeID
- **FK** `FK_CalculationType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** NOC.CalculationTypeSetting (CalculationTypeID); PAY.CalculationPersonel (CalculationTypeID); PAY.Parameter (CalculationTypeID)

### PAY.Category

Rows: 7 | طبقه عامل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CategoryID | int | N |  |  |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | EngName | varchar(250) | N |  |  |
| 5 | OrderInView | int | N | ((1)) |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CategoryID
- **FK** `FK_Category_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Category_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.CategoryParameterType (CategoryID); PAY.FormulaMetaData (CategoryID); PAY.Parameter (CategoryID)

### PAY.CategoryParameterType

Rows: 25 | ارتباط طبقه عامل با نوع پارامتر

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CategoryParameterTypeID | int | N |  |  |
| 2 | CategoryID | int | N |  |  |
| 3 | ParameterTypeID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CategoryParameterTypeID
- **FK** `FK_CategoryParameterType_Category` (CategoryID) -> PAY.Category (CategoryID)
- **FK** `FK_CategoryParameterType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CategoryParameterType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CategoryParameterType_ParameterType` (ParameterTypeID) -> PAY.ParameterType (ParameterTypeID)

### PAY.Establishment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EstablishmentID | int | N |  | identity |
| 2 | ParameterID | int | N |  |  |
| 3 | PersonnelID | int | N |  |  |
| 4 | CalendarMonthID | int | N |  |  |
| 5 | Value | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EstablishmentID
- **FK** `FK_Establishment_Personnel` (PersonnelID) -> HRM.Personel (PersonelID)
- **FK** `FK_Establishment_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_Establishment_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)

### PAY.Formula

Rows: 144 | فرمول حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FormulaID | int | N |  | identity |
| 2 | CalculationMethodID | int | N |  |  |
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

- **Primary key:** FormulaID
- **FK** `FK_Formula_CalculationMethod` (CalculationMethodID) -> PAY.CalculationMethod (CalculationMethodID) on delete CASCADE
- **FK** `FK_Formula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Formula_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.FormulaParameter (FormulaID)

### PAY.FormulaMetaData

Rows: 146 | ارتباطات مربوط به  طبقه،نوع عامل و عامل برای فرمول نویسی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FormulaMetaDataID | int | N |  |  |
| 2 | ParameterTypeID | int | N |  |  |
| 3 | CategoryID | int | Y |  |  |
| 4 | ParameterValueTypeID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FormulaMetaDataID
- **FK** `FK_FormulaMetaData_Category` (CategoryID) -> PAY.Category (CategoryID)
- **FK** `FK_FormulaMetaData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FormulaMetaData_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FormulaMetaData_ParameterType` (ParameterTypeID) -> PAY.ParameterType (ParameterTypeID)
- **FK** `FK_FormulaMetaData_ParameterValueType` (ParameterValueTypeID) -> PAY.ParameterValueType (ParameterValueTypeID)

### PAY.FormulaParameter

Rows: 360 | پارامترهای استفاده شده در فرمول

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FormulaParameterID | int | N |  | identity |
| 2 | FormulaID | int | N |  |  |
| 3 | ParameterID | int | Y |  |  |
| 4 | ParameterValueTypeID | int | Y |  |  |
| 5 | CalculationAggregateFunctionID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FormulaParameterID
- **FK** `FK_FormulaParameter_CalculationAggregateExpression` (CalculationAggregateFunctionID) -> PAY.CalculationAggregateExpression (CalculationAggregateExpressionID)
- **FK** `FK_FormulaParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FormulaParameter_Formula` (FormulaID) -> PAY.Formula (FormulaID) on delete CASCADE
- **FK** `FK_FormulaParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FormulaParameter_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_FormulaParameter_ParameterValueType` (ParameterValueTypeID) -> PAY.ParameterValueType (ParameterValueTypeID)

### PAY.Loan

Rows: 7 | وام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LoanID | int | N |  | identity |
| 2 | Type | tinyint | N |  | شامل سه نوع: 1. تخصیص 1.اصلاح اقساط 2.اصلاح مانده |
| 3 | BaseParentID | int | N |  |  |
| 4 | ParentID | int | Y |  |  |
| 5 | PersonelID | int | N |  |  |
| 6 | ParameterID | int | N |  |  |
| 7 | Number | int | N |  |  |
| 8 | FacilitiesNumber | nvarchar(100) | Y |  |  |
| 9 | Date | date | N |  |  |
| 10 | TotalAmount | decimal(30,4) | N |  |  |
| 11 | Settlement | decimal(30,4) | N |  |  |
| 12 | InstallmentCount | smallint | N |  |  |
| 13 | InstallmentAmount | decimal(30,4) | N |  |  |
| 14 | CalendarMonthID | int | Y |  |  |
| 15 | TotalRound | decimal(30,4) | N |  |  |
| 16 | RoundPayment | tinyint | N |  |  |
| 17 | Description | nvarchar(MAX) | Y |  |  |
| 18 | Description2 | nvarchar(MAX) | Y |  |  |
| 19 | OrganizationItemID | int | Y |  |  |
| 20 | Version | int | N |  |  |
| 21 | Creator | int | N |  |  |
| 22 | CreationDate | datetime | N |  |  |
| 23 | LastEditor | int | N |  |  |
| 24 | LastEditionDate | datetime | N |  |  |
| 25 | PaymentSubjectID | int | Y |  |  |
| 26 | PettyCashCostItemID | int | Y |  |  |
| 27 | DebitCreditNoteItemID | int | Y |  |  |

- **Primary key:** LoanID
- **unique index** `IX_LoanTypeAndNumber` (Type, Number)
- **FK** `FK_Loan_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_Loan_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Loan_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Loan_Loan` (ParentID) -> PAY.Loan (LoanID)
- **FK** `FK_Loan_OrganizationItem` (OrganizationItemID) -> HRM.OrganizationItem (OrganizationItemID)
- **FK** `FK_Loan_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_Loan_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **Referenced by:** PAY.Loan (ParentID); PAY.PostponedLoan (LoanID)

### PAY.Parameter

Rows: 109 | عامل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterID | int | N |  | identity |
| 2 | CategoryID | int | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | ParameterTypeID | int | N |  |  |
| 6 | Type | tinyint | Y |  |  |
| 7 | OrganizationID | int | Y |  |  |
| 8 | ReCalcable | bit | N |  |  |
| 9 | HasEstablishment | bit | N |  |  |
| 10 | IsSystem | bit | N | ((0)) |  |
| 11 | DataEntryType | tinyint | N | ((0)) |  |
| 12 | SystemName | varchar(50) | Y |  |  |
| 13 | CalculationTypeID | tinyint | N | ((1)) |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | PaymentTypeID | int | Y |  |  |
| 20 | DependantToYear | bit | Y |  |  |
| 21 | Code | int | Y |  |  |

- **Primary key:** ParameterID
- **FK** `FK_Parameter_PaymentType` (PaymentTypeID) -> FIN.PaymentType (PaymentTypeID)
- **FK** `FK_Parameter_CalculationType` (CalculationTypeID) -> PAY.CalculationType (CalculationTypeID)
- **FK** `FK_Parameter_Category` (CategoryID) -> PAY.Category (CategoryID)
- **FK** `FK_Parameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Parameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Parameter_Organization` (OrganizationID) -> HRM.Organization (OrganizationID)
- **FK** `FK_Parameter_ParameterType` (ParameterTypeID) -> PAY.ParameterType (ParameterTypeID)
- **Referenced by:** ATN.AttendanceCalculationMethod (ParameterID); ATN.PayParameterCalculationResult (ParameterID); HRM.AgreementBatchModelFormula (ParameterID); HRM.AgreementParameter (ParameterID); HRM.AgreementTypeInterpretation (ParameterID); HRM.PaymentSystemCalculationMethod (ParameterID); NOC.CalculationTypeSetting (BenefitParameterID); NOC.CalculationTypeSetting (DifferenceParameterid); NOC.CalculationTypeSetting (NetPaymentParameterID); NOC.CalculationTypeSetting (ReserveParameterID); NOC.FractionPayrollParameterSetting (ParameterID); PAY.CalculationAggregateParameter (ParameterID); PAY.CalculationBackPayResult (ParameterID); PAY.CalculationMethod (ParameterID); PAY.CalculationResult (ParameterID); PAY.Establishment (ParameterID); PAY.FormulaParameter (ParameterID); PAY.Loan (ParameterID); PAY.ParameterConstantData (ParameterID); PAY.ParameterMonthlyData (ParameterID); PAY.ParameterMonthlyDataFilterParameter (ParameterID); PAY.ParameterOrder (ParameterID); PAY.PayPreparingItem (ParameterID); PAY.PayrollAccConfiguration (ParameterID); PAY.PayrollPaymentTypeParameter (ParameterID); PAY.TimeSheetCalculationResult (ParameterID); REQ.LoanRequest (ParameterID)

### PAY.ParameterConstantData

Rows: 0 | مقادیر ثابت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterConstantDataID | int | N |  | identity |
| 2 | ParameterID | int | N |  |  |
| 3 | PersonnelID | int | N |  |  |
| 4 | CalendarMonthID | int | N |  |  |
| 5 | Value | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ParameterConstantDataID
- **unique index** `IX_ParameterConstantData` (CalendarMonthID, PersonnelID, ParameterID)
- **FK** `FK_ParameterConstantData_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_ParameterConstantData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterConstantData_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ParameterConstantData_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_ParameterConstantData_Personel` (PersonnelID) -> HRM.Personel (PersonelID)

### PAY.ParameterMonthlyData

Rows: 12009 | مقادیر ماهیانه عامل 

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterMonthlyDataID | int | N |  | identity |
| 2 | ParameterID | int | N |  |  |
| 3 | PersonnelID | int | N |  |  |
| 4 | CalendarMonthID | int | N |  |  |
| 5 | IssueCalendarMonthID | int | N |  |  |
| 6 | Value | decimal(30,4) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | PaymentSubjectID | int | Y |  |  |
| 13 | PettyCashCostItemID | int | Y |  |  |
| 14 | DebitCreditNoteItemID | int | Y |  |  |

- **Primary key:** ParameterMonthlyDataID
- **unique index** `IX_ParameterMonthlyData` (CalendarMonthID, IssueCalendarMonthID, ParameterID, PersonnelID, PaymentSubjectID, PettyCashCostItemID, DebitCreditNoteItemID)
- **FK** `FK_ParameterMonthlyData_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)
- **FK** `FK_ParameterMonthlyData_PettyCashCostItem` (PettyCashCostItemID) -> FIN.PettyCashCostItem (PettyCashCostItemID)
- **FK** `FK_ParameterMonthlyData_DebitCreditNoteItem` (DebitCreditNoteItemID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_ParameterMonthlyData_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_ParameterMonthlyData_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_ParameterMonthlyData_Personel` (PersonnelID) -> HRM.Personel (PersonelID)
- **FK** `FK_ParameterMonthlyData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyData_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.ParameterMonthlyDataFilter

Rows: 1 | روش ورود اطلاعات

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterMonthlyDataFilterID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | PersonelCode | bit | N |  |  |
| 5 | PersonelName | bit | N |  |  |
| 6 | WorkPlace | bit | N |  |  |
| 7 | CostCenter | bit | N |  |  |
| 8 | EmploymentType | bit | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | IsForSystemParameterTypes | bit | N | ((0)) |  |
| 15 | SystemType | tinyint | Y |  |  |
| 16 | NationalCode | bit | N | ((0)) |  |
| 17 | Branch | bit | N | ((0)) |  |

- **Primary key:** ParameterMonthlyDataFilterID
- **unique index** `IX_Title` (Title)
- **FK** `FK_ParameterMonthlyDataFilter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyDataFilter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.ParameterMonthlyDataFilterEmploymentType (ParameterMonthlyDataFilterID); PAY.ParameterMonthlyDataFilterParameter (ParameterMonthlyDataFilterID)

### PAY.ParameterMonthlyDataFilterEmploymentType

Rows: 1 | ارتباط روش ورود اطلاعات با نوع استخدام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterMonthlyDataFilterEmploymentTypeID | int | N |  | identity |
| 2 | ParameterMonthlyDataFilterID | int | N |  |  |
| 3 | EmploymentTypeID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ParameterMonthlyDataFilterEmploymentTypeID
- **FK** `FK_ParameterMonthlyDataFilterEmploymentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyDataFilterEmploymentType_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID) on delete CASCADE
- **FK** `FK_ParameterMonthlyDataFilterEmploymentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyDataFilterEmploymentType_ParameterMonthlyDataFilter` (ParameterMonthlyDataFilterID) -> PAY.ParameterMonthlyDataFilter (ParameterMonthlyDataFilterID) on delete CASCADE

### PAY.ParameterMonthlyDataFilterParameter

Rows: 11 | پارامترهای روش ورود اطلاعات

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterMonthlyDataFilterParameterID | int | N |  | identity |
| 2 | ParameterMonthlyDataFilterID | int | N |  |  |
| 3 | ParameterID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ParameterMonthlyDataFilterParameterID
- **FK** `FK_ParameterMonthlyDataFilterParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyDataFilterParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ParameterMonthlyDataFilterParameter_Parameter` (ParameterID) -> PAY.Parameter (ParameterID) on delete CASCADE
- **FK** `FK_ParameterMonthlyDataFilterParameter_ParameterMonthlyDataFilter` (ParameterMonthlyDataFilterID) -> PAY.ParameterMonthlyDataFilter (ParameterMonthlyDataFilterID) on delete CASCADE

### PAY.ParameterOrder

Rows: 0 | ترتیب عامل در قرارداد و فیش حقوقی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterOrderID | int | N |  | identity |
| 2 | ParameterID | int | N |  |  |
| 3 | OrderType | tinyint | N |  |  |
| 4 | OrderIndex | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ParameterOrderID
- **FK** `FK_ParameterOrder_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterOrder_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ParameterOrder_Parameter` (ParameterID) -> PAY.Parameter (ParameterID) on delete CASCADE

### PAY.ParameterType

Rows: 8 | نوع پارامتر

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterTypeID | int | N |  |  |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | EngName | varchar(250) | N |  |  |
| 5 | OrderInView | int | N | ((1)) |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ParameterTypeID
- **FK** `FK_ParameterType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.CategoryParameterType (ParameterTypeID); PAY.FormulaMetaData (ParameterTypeID); PAY.Parameter (ParameterTypeID)

### PAY.ParameterValueType

Rows: 29 | نوع مقدار پارامتر

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterValueTypeID | int | N |  |  |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | EngName | varchar(250) | N |  |  |
| 5 | OrderInView | int | N | ((1)) |  |
| 6 | Type | tinyint | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ParameterValueTypeID
- **FK** `FK_ParameterValueType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ParameterValueType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** HRM.AgreementBatchModelFormulaParameter (ParameterValueTypeID); PAY.CalculationResult (ParameterValueTypeID); PAY.FormulaMetaData (ParameterValueTypeID); PAY.FormulaParameter (ParameterValueTypeID)

### PAY.PayPreparing

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayPreparingID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | PayrollPaymentTypeID | int | N |  |  |
| 5 | OrganizationItemID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Number | int | Y |  |  |
| 12 | BankBranchID | int | Y |  |  |
| 13 | PayrollFileID | int | Y |  |  |
| 14 | PaymentRound | decimal(30,4) | N |  |  |

- **Primary key:** PayPreparingID
- **FK** `FK_PayPreparing_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PayPreparing_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PayPreparing_PayrollPaymentType` (PayrollPaymentTypeID) -> PAY.PayrollPaymentType (PayrollPaymentTypeID)
- **FK** `FK_PayPreparing_OrganizationItem` (OrganizationItemID) -> HRM.OrganizationItem (OrganizationItemID)
- **FK** `FK_PayPreparing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayPreparing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayPreparing_BankBranchID` (BankBranchID) -> CFG.BankBranch (BankBranchID)
- **FK** `FK_PayPreparing_PayrollFileID` (PayrollFileID) -> PAY.PayrollFile (PayrollFileID)
- **Referenced by:** CFG.DebitCreditNoteItem (PayPreparingID); FIN.PaymentSubject (PayPreparingID); FIN.PettyCashCostItem (PayPreparingID); PAY.PayPreparingItem (PayPreparingID); REQ.PaymentOrderItem (PayPreparingID)

### PAY.PayPreparingItem

Rows: 45

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayPreparingItemID | int | N |  | identity |
| 2 | PayPreparingID | int | N |  |  |
| 3 | PersonnelID | int | N |  |  |
| 4 | ParameterID | int | N |  |  |
| 5 | Value | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PayPreparingItemID
- **FK** `FK_PayPreparingItem_PayPreparing` (PayPreparingID) -> PAY.PayPreparing (PayPreparingID) on delete CASCADE
- **FK** `FK_PayPreparingItem_Personnel` (PersonnelID) -> HRM.Personel (PersonelID)
- **FK** `FK_PayPreparingItem_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_PayPreparingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayPreparingItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.PayrollAccConfiguration

Rows: 38 | ارتباط سند با حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollAccConfigurationID | int | N |  | identity |
| 2 | PayrollAccGroupID | tinyint | N |  |  |
| 3 | ParameterID | int | N |  |  |
| 4 | SlID | int | N |  |  |
| 5 | BalanceType | tinyint | N |  |  |
| 6 | Description | nvarchar(1024) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Description2 | nvarchar(1024) | N |  |  |
| 13 | CalendarMonthID | int | N |  |  |
| 14 | IsActive | bit | Y | ((1)) |  |

- **Primary key:** PayrollAccConfigurationID
- **FK** `FK_PayrollAccConfiguration_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PayrollAccConfiguration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollAccConfiguration_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollAccConfiguration_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_PayrollAccConfiguration_PayrollAccGroup` (PayrollAccGroupID) -> PAY.PayrollAccGroup (PayrollAccGroupID)
- **FK** `FK_PayrollAccConfiguration_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** PAY.PayrollAccConfigurationPartyType (PayrollAccConfigurationID)

### PAY.PayrollAccConfigurationPartyType

Rows: 18 | ارتباط سند با حقوق با  با نوع طرف حساب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollAccConfigurationPartyTypeID | int | N |  | identity |
| 2 | PayrollAccConfigurationID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | PartyType | tinyint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PayrollAccConfigurationPartyTypeID
- **unique index** `IX_PayrollAccConfigurationPartyType` (PayrollAccConfigurationID, AccountLevelID)
- **FK** `FK_PayrollAccConfigurationPartyType_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_PayrollAccConfigurationPartyType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollAccConfigurationPartyType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollAccConfigurationPartyType_PayrollAccConfiguration` (PayrollAccConfigurationID) -> PAY.PayrollAccConfiguration (PayrollAccConfigurationID) on delete CASCADE

### PAY.PayrollAccGroup

Rows: 1 | گروه حساب حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollAccGroupID | tinyint | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | Code | tinyint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | IsShareable | bit | N | ((0)) |  |
| 11 | ShareBaseDlTypeId | int | Y |  |  |
| 12 | AgentToServe | tinyint | N | ((0)) |  |

- **Primary key:** PayrollAccGroupID
- **FK** `FK_PayrollAccGroup_DlType` (ShareBaseDlTypeId) -> ACC.DlType (DlTypeID)
- **FK** `FK_PayrollAccGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollAccGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.PayrollAccConfiguration (PayrollAccGroupID); PAY.PersonelVoucherSetting (PayrollAccGroupID)

### PAY.PayrollDlType

Rows: 1 | انواع تفصیل دخیل در حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollDlTypeID | int | N |  | identity |
| 2 | DlTypeID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PayrollDlTypeID
- **FK** `FK_PayrollDlType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollDlType_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_PayrollDlType_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.PayrollFile

Rows: 4 | ساختار فایل حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollFileID | int | N |  | identity |
| 2 | IsOrgan | bit | N |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Title2 | nvarchar(512) | N |  |  |
| 5 | OrganizationID | int | Y |  |  |
| 6 | BankID | int | Y |  |  |
| 7 | Seprator | varchar(5) | Y |  |  |
| 8 | FileName | nvarchar(128) | N |  |  |
| 9 | FileItemName | nvarchar(512) | Y |  |  |
| 10 | FileType | varchar(50) | N |  |  |
| 11 | FileExt | varchar(50) | N |  |  |
| 12 | HasSeprateItem | bit | N |  |  |
| 13 | FileHasHeader | bit | N | ((1)) |  |
| 14 | PaymentTopicID | tinyint | N | ((1)) |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | EncodingType | tinyint | N | ((1)) |  |

- **Primary key:** PayrollFileID
- **FK** `FK_PayrollFile_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_PayrollFile_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollFile_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollFile_Organization` (OrganizationID) -> HRM.Organization (OrganizationID)
- **FK** `FK_PayrollFile_PaymentTopic` (PaymentTopicID) -> HRM.PaymentTopic (PaymentTopicID)
- **Referenced by:** PAY.PayPreparing (PayrollFileID); PAY.PayrollFileItem (PayrollFileID)

### PAY.PayrollFileItem

Rows: 139 | آیتم ساختار فایل حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollFileItemID | int | N |  | identity |
| 2 | PayrollFileID | int | N |  |  |
| 3 | Title | nvarchar(50) | N |  |  |
| 4 | Title2 | nvarchar(50) | N |  |  |
| 5 | EngName | nvarchar(50) | N |  |  |
| 6 | ItemType | tinyint | N |  |  |
| 7 | ItemValueType | tinyint | Y |  |  |
| 8 | ItemValue | nvarchar(2048) | N |  |  |
| 9 | ItemLength | int | Y |  |  |
| 10 | AggFunc | varchar(50) | Y |  |  |
| 11 | PaddingChar | char(1) | Y |  |  |
| 12 | ItemOrder | int | N | ((0)) |  |
| 13 | ItemRealType | tinyint | N | ((0)) |  |
| 14 | ItemDataSourceType | tinyint | N | ((0)) |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | DisplayTarget | tinyint | N | ((1)) |  |

- **Primary key:** PayrollFileItemID
- **FK** `FK_PayrollFileItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollFileItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayrollFileItem_PayrollFile` (PayrollFileID) -> PAY.PayrollFile (PayrollFileID) on delete CASCADE

### PAY.PayrollListSetting

Rows: 1 | تنظیمات لیست حقوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollListSettingID | int | N |  | identity |
| 2 | Value | nvarchar(MAX) | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PayrollListSettingID
- **FK** `FK_PayrollListSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollListSetting_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.PayrollPaymentType

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollPaymentTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | OrganizationID | int | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | IsActive | bit | Y | ((1)) |  |
| 13 | CreatePayrollFile | bit | N | ((0)) |  |

- **Primary key:** PayrollPaymentTypeID
- **FK** `FK_PayrollPaymentType_Organization` (OrganizationID) -> HRM.Organization (OrganizationID)
- **FK** `FK_PayrollPaymentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollPaymentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PAY.PayPreparing (PayrollPaymentTypeID); PAY.PayrollPaymentTypeParameter (PayrollPaymentTypeID)

### PAY.PayrollPaymentTypeParameter

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayrollPaymentTypeParameterID | int | N |  | identity |
| 2 | PayrollPaymentTypeID | int | N |  |  |
| 3 | ParameterID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** PayrollPaymentTypeParameterID
- **FK** `FK_PayrollPaymentTypeParameter_PayrollPaymentType` (PayrollPaymentTypeID) -> PAY.PayrollPaymentType (PayrollPaymentTypeID) on delete CASCADE
- **FK** `FK_PayrollPaymentTypeParameter_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_PayrollPaymentTypeParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayrollPaymentTypeParameter_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.PersonelVoucherSetting

Rows: 508 | تنظیمات صدور سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelVoucherSettingID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | PayrollAccGroupID | tinyint | N |  |  |
| 5 | MissionOrganizationDlId | bigint | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PersonelVoucherSettingID
- **unique index** `IX_PersonelVoucherSetting` (PersonelID, CalendarMonthID)
- **FK** `FK_PersonelVoucherSetting_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PersonelVoucherSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelVoucherSetting_DL` (MissionOrganizationDlId) -> ACC.DL (DLID)
- **FK** `FK_PersonelVoucherSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelVoucherSetting_PayrollAccGroup` (PayrollAccGroupID) -> PAY.PayrollAccGroup (PayrollAccGroupID)
- **FK** `FK_PersonelVoucherSetting_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **Referenced by:** PAY.PersonelVoucherSettingDl (PersonelVoucherSettingID)

### PAY.PersonelVoucherSettingDl

Rows: 230 | ارتباط تنظیمات صدور سند با تفصیل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelVoucherSettingDlID | int | N |  | identity |
| 2 | PersonelVoucherSettingID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PersonelVoucherSettingDlID
- **FK** `FK_PersonelVoucherSettingDl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelVoucherSettingDl_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PersonelVoucherSettingDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_PersonelVoucherSettingDl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelVoucherSettingDl_PersonelVoucherSetting` (PersonelVoucherSettingID) -> PAY.PersonelVoucherSetting (PersonelVoucherSettingID) on delete CASCADE

### PAY.Postpone

Rows: 0 | تعلیق وام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PostponeID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | StartCalendarMonthID | int | N |  |  |
| 5 | EndCalendarMonthID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PostponeID
- **FK** `FK_PostPone_Creator` (Creator) -> CFG.User (UserID) on delete CASCADE
- **FK** `FK_PostPone_EndCalendarMonth` (EndCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_PostPone_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PostPone_StartCalendarMonth` (StartCalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **Referenced by:** PAY.PostponedLoan (PostponeID)

### PAY.PostponedLoan

Rows: 0 | قلم تعلیق وام

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PostponedLoanID | int | N |  | identity |
| 2 | PostponeID | int | N |  |  |
| 3 | LoanID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PostponedLoanID
- **FK** `FK_PostponedLoan_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PostponedLoan_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PostponedLoan_Loan` (LoanID) -> PAY.Loan (LoanID)
- **FK** `FK_PostponedLoan_Postpone` (PostponeID) -> PAY.Postpone (PostponeID) on delete CASCADE

### PAY.SettlementCalculation

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SettlementCalculationID | int | N |  | identity |
| 2 | Value | decimal(30,4) | N |  |  |
| 3 | Paid | decimal(30,4) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | CalculationPersonelID | int | Y |  |  |
| 10 | BaseCalculationPersonelID | int | Y |  |  |

- **Primary key:** SettlementCalculationID
- **FK** `FK_SettlementCalculation_CalculationPersonel` (CalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID) on delete CASCADE
- **FK** `FK_SettlementCalculation_BaseCalculationPersonel` (BaseCalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID)
- **FK** `FK_SettlementCalculation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SettlementCalculation_LastEditor` (LastEditor) -> CFG.User (UserID)

### PAY.SettlementItem_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SettlementItemID | int | N |  | identity |
| 2 | SettlementID | int | Y |  |  |
| 3 | SettlementParameterID | int | Y |  |  |
| 4 | LoanID | int | Y |  |  |
| 5 | Amount | decimal(18,4) | N |  |  |
| 6 | Remain | decimal(18,4) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Description | nvarchar(512) | Y |  |  |
| 9 | Description2 | nvarchar(512) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | CalculationPersonelID | int | Y |  |  |


### PAY.SettlementParameter_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SettlementParameterID | int | N |  | identity |
| 2 | Title | nvarchar(250) | Y |  |  |
| 3 | Title2 | nvarchar(250) | Y |  |  |
| 4 | ParameterID | int | Y |  |  |
| 5 | SettlementParameterType | tinyint | N |  |  |
| 6 | SettlementParameterForm | tinyint | N |  |  |
| 7 | SlID | int | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | RelatedParameterID | int | Y |  |  |


### PAY.TimeSheet

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TimeSheetId | int | N |  | identity |
| 2 | CalendarMonthID | int | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Value | decimal(36,10) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TimeSheetId
- **FK** `FK_TimeSheet_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TimeSheet_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_TimeSheet_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TimeSheet_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TimeSheet_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)

### PAY.TimeSheetCalculationPersonel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TimeSheetCalculationPersonelID | int | N |  | identity |
| 2 | CalculationPersonelID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TimeSheetCalculationPersonelID
- **FK** `FK_TimeSheetCalculationPersonel_CalculationPersonel` (CalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID)

### PAY.TimeSheetCalculationResult

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TimeSheetCalculationResultID | int | N |  | identity |
| 2 | CalendarMonthID | int | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | ParameterID | int | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | DlID | bigint | N |  |  |
| 7 | Value | decimal(36,10) | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | CalculationPersonelID | int | Y |  |  |
| 11 | LastEditor | int | Y |  |  |
| 12 | LastEditionDate | datetime | Y |  |  |

- **Primary key:** TimeSheetCalculationResultID
- **FK** `FK_TimeSheetCalculationResult_CalculationPersonel` (CalculationPersonelID) -> PAY.CalculationPersonel (CalculationPersonelID)
- **FK** `FK_TimeSheetCalculationResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TimeSheetCalculationResult_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_TimeSheetCalculationResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TimeSheetCalculationResult_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_TimeSheetCalculationResult_SL` (SlID) -> ACC.SL (SlID)

## Views

### PAY.CalculationResult_NonPayment

Definition: `programmability/views/PAY.CalculationResult_NonPayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CalculationResultID | decimal(18,0) | N |
| 2 | Value | decimal(30,10) | N |
| 3 | Paid | decimal(38,4) | Y |
| 4 | Remain | decimal(38,4) | Y |

### PAY.PayrollAccConfigurationCalendarMonth

Definition: `programmability/views/PAY.PayrollAccConfigurationCalendarMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | rno | bigint | Y |
| 2 | CalendarMonthID | int | N |
| 3 | EndDate | date | N |
| 4 | PayrollAccGroupID | tinyint | N |
| 5 | ParameterID | int | N |
| 6 | SlID | int | N |
| 7 | BalanceType | tinyint | N |
| 8 | Description | nvarchar(1024) | N |
| 9 | Description2 | nvarchar(1024) | N |
| 10 | LastDate | date | N |
| 11 | PayrollAccConfigurationID | int | N |
| 12 | IsActive | bit | Y |

### PAY.vwPayPreparingRemain

Definition: `programmability/views/PAY.vwPayPreparingRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PayPreparingID | int | N |
| 2 | Value | decimal(38,4) | Y |
| 3 | Done | decimal(38,4) | Y |
| 4 | Remain | decimal(38,4) | Y |
| 5 | RequestedAndPaidRemain | decimal(38,4) | Y |

### PAY.vwPayrollAccConfiguration

Definition: `programmability/views/PAY.vwPayrollAccConfiguration.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | rno | bigint | Y |
| 2 | CalendarMonthID | int | N |
| 3 | EndDate | date | N |
| 4 | LastDate | date | N |
| 5 | PayrollAccGroupID | tinyint | N |
| 6 | ParameterID | int | N |
| 7 | SlID | int | N |
| 8 | BalanceType | tinyint | N |
| 9 | CalculationTypeID | tinyint | N |
| 10 | Description | nvarchar(1024) | N |
| 11 | IsShareable | bit | N |
| 12 | ShareBaseDlTypeId | int | Y |

### PAY.vwPersonelDebit

Definition: `programmability/views/PAY.vwPersonelDebit.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | ItemType | int | N |
| 3 | Title | nvarchar(1054) | Y |
| 4 | PartyID | bigint | Y |
| 5 | Amount | decimal(30,4) | N |
| 6 | Date | date | N |
| 7 | PaymentTypeID | int | Y |
| 8 | BranchID | int | N |
| 9 | CurrencyID | int | N |
| 10 | PersonelID | int | N |
| 11 | RemainValue | decimal(38,4) | Y |

### PAY.vwPersonelLoanDebit

Definition: `programmability/views/PAY.vwPersonelLoanDebit.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | ItemType | int | N |
| 3 | Title | nvarchar(1054) | Y |
| 4 | PartyID | bigint | Y |
| 5 | Amount | decimal(30,4) | N |
| 6 | Date | date | N |
| 7 | PaymentTypeID | int | Y |
| 8 | BranchID | int | N |
| 9 | CurrencyID | int | N |
| 10 | PersonelId | int | N |
| 11 | RemainValue | decimal(38,4) | Y |
| 12 | ParameterTitle | nvarchar(250) | N |
| 13 | ParameterID | int | N |

### PAY.vwPersonelLoanStatus

Definition: `programmability/views/PAY.vwPersonelLoanStatus.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | LoanID | int | N |
| 2 | PersonelID | int | N |
| 3 | TotalAmount | decimal(30,4) | N |
| 4 | PlannedInstallmentAmount | decimal(30,4) | N |
| 5 | DeductedAmount | decimal(38,10) | Y |
| 6 | RemainAmount | decimal(38,10) | Y |
| 7 | InstallmentAmount | decimal(38,10) | Y |

### PAY.vwPersonelVoucherSetting

Definition: `programmability/views/PAY.vwPersonelVoucherSetting.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | rno | bigint | Y |
| 2 | CalendarMonthID | int | N |
| 3 | EndDate | date | N |
| 4 | LastDate | date | N |
| 5 | PayrollAccGroupID | tinyint | N |
| 6 | PersonelID | int | N |
| 7 | PayrollAccGroupTitle | nvarchar(512) | N |

