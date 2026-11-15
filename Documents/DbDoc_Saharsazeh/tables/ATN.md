# Schema `ATN`

## Tables

### ATN.AtnParameterCalculationResult

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AtnParameterCalculationResultID | decimal(18,0) | N |  | identity |
| 2 | AttendanceCalculationPersonnelID | int | N |  |  |
| 3 | AttendanceParameterID | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Value | decimal(30,10) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | AttendanceShiftItemID | int | Y |  |  |

- **Primary key:** AtnParameterCalculationResultID
- **FK** `FK_AtnParameterCalculationResult_AttendanceCalculationPersonnel` (AttendanceCalculationPersonnelID) -> ATN.AttendanceCalculationPersonnel (AttendanceCalculationPersonnelID) on delete CASCADE
- **FK** `FK_AtnParameterCalculationResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AtnParameterCalculationResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AtnParameterCalculationResult_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)
- **FK** `FK_AtnParameterCalculationResult_AttendanceShiftItem` (AttendanceShiftItemID) -> ATN.AttendanceShiftItem (AttendanceShiftItemID)

### ATN.AttendanceCalculationMethod

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceCalculationMethodID | int | N |  | identity |
| 2 | Date | date | Y |  |  |
| 3 | ParameterID | int | Y |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Type | tinyint | N |  |  |
| 10 | CalendarMonthID | int | Y |  |  |
| 11 | AttendanceParameterID | int | Y |  |  |

- **Primary key:** AttendanceCalculationMethodID
- **FK** `FK_AttendanceCalculationMethod_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_AttendanceCalculationMethod_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_AttendanceCalculationMethod_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)
- **FK** `FK_AttendanceCalculationMethod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceCalculationMethod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceCalculationMethodFormula (AttendanceCalculationMethodID)

### ATN.AttendanceCalculationMethodFormula

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceCalculationMethodFormulaID | int | N |  | identity |
| 2 | AttendanceCalculationMethodID | int | N |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Expression | nvarchar(MAX) | N |  |  |
| 5 | Condition | nvarchar(MAX) | Y |  |  |
| 6 | SQLExpression | nvarchar(MAX) | Y |  |  |
| 7 | SQLCondition | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** AttendanceCalculationMethodFormulaID
- **FK** `FK_AttendanceCalculationMethodFormula_AttendanceCalculationMethod` (AttendanceCalculationMethodID) -> ATN.AttendanceCalculationMethod (AttendanceCalculationMethodID) on delete CASCADE
- **FK** `FK_AttendanceCalculationMethodFormula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceCalculationMethodFormula_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceCalculationMethodFormulaParameter (AttendanceCalculationMethodFormulaID)

### ATN.AttendanceCalculationMethodFormulaParameter

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceCalculationMethodFormulaParameterID | int | N |  | identity |
| 2 | AttendanceCalculationMethodFormulaID | int | N |  |  |
| 3 | ParameterType | tinyint | Y |  |  |
| 4 | Category | int | Y |  |  |
| 5 | ParameterValueType | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Parameter | int | Y |  |  |

- **Primary key:** AttendanceCalculationMethodFormulaParameterID
- **FK** `FK_AttendanceCalculationMethodFormulaParameter_AttendanceCalculationMethodFormula` (AttendanceCalculationMethodFormulaID) -> ATN.AttendanceCalculationMethodFormula (AttendanceCalculationMethodFormulaID) on delete CASCADE
- **FK** `FK_AttendanceCalculationMethodFormulaParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceCalculationMethodFormulaParameter_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.AttendanceCalculationPersonnel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceCalculationPersonnelID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | ToDate | date | N |  |  |
| 5 | CalculationDate | datetime | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Status | tinyint | N | ((1)) |  |

- **Primary key:** AttendanceCalculationPersonnelID
- **FK** `FK_AttendanceCalculationPersonnel_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_AttendanceCalculationPersonnel_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_AttendanceCalculationPersonnel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceCalculationPersonnel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AtnParameterCalculationResult (AttendanceCalculationPersonnelID); ATN.PayParameterCalculationResult (AttendanceCalculationPersonnelID)

### ATN.AttendanceCalendar

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceCalendarID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | AttendanceShiftID | int | N |  |  |
| 4 | EndHour | decimal(18,0) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | StartHour | decimal(18,0) | Y |  |  |
| 11 | DayType | tinyint | N | ((0)) |  |

- **Primary key:** AttendanceCalendarID
- **FK** `FK_AttendanceCalendar_AttendanceShift` (AttendanceShiftID) -> ATN.AttendanceShift (AttendanceShiftID)
- **FK** `FK_AttendanceCalendar_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceCalendar_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.AttendanceChangeRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceChangeRequestID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | EntryHour | decimal(18,0) | Y |  |  |
| 6 | ExitHour | decimal(18,0) | Y |  |  |
| 7 | Description | nvarchar(512) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | ReviewDate | datetime | Y |  |  |
| 14 | ReviewerID | int | Y |  |  |

- **Primary key:** AttendanceChangeRequestID
- **FK** `FK_AttendanceChangeRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceChangeRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AttendanceChangeRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_AttendanceChangeRequest_Reviewer` (ReviewerID) -> CFG.User (UserID)
- **Referenced by:** ATN.EntryAndExit (AttendanceChangeRequestID)

### ATN.AttendanceDevice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceDeviceID | int | N |  | identity |
| 2 | DeviceIdentity | nvarchar(256) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AttendanceDeviceID
- **FK** `FK_AttendanceDevice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceDevice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.PersonelAttendanceDevice (AttendanceDeviceID)

### ATN.AttendanceGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceGroupID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | AttendanceGroupTypeID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AttendanceGroupID
- **FK** `FK_AttendanceGroup_AttendanceGroupType` (AttendanceGroupTypeID) -> ATN.AttendanceGroupType (AttendanceGroupTypeID)
- **FK** `FK_AttendanceGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.GroupAssignment (AttendanceGroupID)

### ATN.AttendanceGroupType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceGroupTypeID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AttendanceGroupTypeID
- **FK** `FK_AttendanceGroupType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceGroupType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceGroup (AttendanceGroupTypeID)

### ATN.AttendanceParameter

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceParameterID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | DataEntryMethod | tinyint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | DisplayInPerformanceReport | bit | N | ((0)) |  |
| 11 | Type | tinyint | N | ((2)) |  |
| 12 | TimingMethod | tinyint | N | ((1)) |  |

- **Primary key:** AttendanceParameterID
- **FK** `FK_AttendanceParameter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceParameter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AtnParameterCalculationResult (AttendanceParameterID); ATN.AttendanceCalculationMethod (AttendanceParameterID); ATN.JustificationRegistration (AttendanceParameterID); ATN.PayParameterCalculationResult (AttendanceParameterID); ATN.VacancyNature (AttendanceParameterID); HRM.OtherPersonnelInformation (AttendanceParameterID)

### ATN.AttendanceShift

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceShiftID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | StartDate | date | N |  |  |
| 11 | ShiftPeriod | int | N |  |  |

- **Primary key:** AttendanceShiftID
- **FK** `FK_AttendanceShift_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceShift_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceCalendar (AttendanceShiftID); ATN.AttendanceShiftItem (AttendanceShiftID); ATN.AttendanceTimeInterpretation (AttendanceShiftID); ATN.PersonnelShiftAssignmentItem (AttendanceShiftID)

### ATN.AttendanceShiftItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceShiftItemID | int | N |  | identity |
| 2 | AttendanceShiftID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Day | tinyint | N |  |  |
| 5 | StartHour | decimal(18,10) | Y |  |  |
| 6 | EndHour | decimal(18,10) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | StartDay | int | N |  |  |
| 13 | EndDay | int | N |  |  |
| 14 | VacancyDuration | int | Y |  |  |
| 15 | DayType | tinyint | Y | ((0)) |  |
| 16 | EarlyEntryAllowed | decimal(18,10) | Y |  |  |
| 17 | LateExitAllowed | decimal(18,10) | Y |  |  |

- **Primary key:** AttendanceShiftItemID
- **FK** `FK_AttendanceShiftItem_AttendanceShift` (AttendanceShiftID) -> ATN.AttendanceShift (AttendanceShiftID) on delete CASCADE
- **FK** `FK_AttendanceShiftItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceShiftItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AtnParameterCalculationResult (AttendanceShiftItemID); ATN.AttendanceTimeInterpretationItem (AttendanceShiftItemID)

### ATN.AttendanceTimeInterpretation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceTimeInterpretationID | int | N |  | identity |
| 2 | AttendanceShiftID | int | N |  |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AttendanceTimeInterpretationID
- **FK** `FK_AttendanceTimeInterpretation_AttendanceShift` (AttendanceShiftID) -> ATN.AttendanceShift (AttendanceShiftID)
- **FK** `FK_AttendanceTimeInterpretation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceTimeInterpretation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.AttendanceTimeInterpretationItem (AttendanceTimeInterpretationID)

### ATN.AttendanceTimeInterpretationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AttendanceTimeInterpretationItemID | int | N |  | identity |
| 2 | AttendanceTimeInterpretationID | int | N |  |  |
| 3 | AttendanceShiftItemID | int | N |  |  |
| 4 | RowIndex | smallint | N |  |  |
| 5 | StartHour | decimal(18,10) | N |  |  |
| 6 | StartDay | int | N |  |  |
| 7 | EndHour | decimal(18,10) | N |  |  |
| 8 | EndDay | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** AttendanceTimeInterpretationItemID
- **FK** `FK_AttendanceTimeInterpretationItem_AttendanceTimeInterpretation` (AttendanceTimeInterpretationID) -> ATN.AttendanceTimeInterpretation (AttendanceTimeInterpretationID) on delete CASCADE
- **FK** `FK_AttendanceTimeInterpretation_AttendanceShiftItem` (AttendanceShiftItemID) -> ATN.AttendanceShiftItem (AttendanceShiftItemID)
- **FK** `FK_AttendanceTimeInterpretationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AttendanceTimeInterpretationItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.CalculationResult_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelID | int | Y |  |  |
| 2 | ParameterID | int | Y |  |  |
| 3 | Date | date | Y |  |  |
| 4 | Value | int | Y |  |  |


### ATN.EntryAndExit

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EntryAndExitID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Hour | decimal(18,0) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | AttendanceChangeRequestID | int | Y |  |  |
| 11 | EntryAndExitStatus | tinyint | N | ((1)) |  |

- **Primary key:** EntryAndExitID
- **FK** `FK_EntryAndExit_AttendanceChangeRequest` (AttendanceChangeRequestID) -> ATN.AttendanceChangeRequest (AttendanceChangeRequestID)
- **FK** `FK_EntryAndExit_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_EntryAndExit_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EntryAndExit_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.GroupAssignment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | GroupAssignmentID | int | N |  | identity |
| 2 | CalendarMonthID | int | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | AttendanceGroupID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** GroupAssignmentID
- **FK** `FK_GroupAssignment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_GroupAssignment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_GroupAssignment_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_GroupAssignment_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_GroupAssignment_AttendanceGroup` (AttendanceGroupID) -> ATN.AttendanceGroup (AttendanceGroupID)

### ATN.JustificationRegistration

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | JustificationRegistrationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | EffectiveDate | date | N |  |  |
| 5 | PersonelID | int | N |  |  |
| 6 | AttendanceParameterID | int | N |  |  |
| 7 | Value | decimal(30,4) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** JustificationRegistrationID
- **FK** `FK_JustificationRegistration_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_JustificationRegistration_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)
- **FK** `FK_JustificationRegistration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_JustificationRegistration_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.LeaveRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LeaveRequestID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | RequestTypeID | int | Y |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | Status | tinyint | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | StartDate | date | N |  |  |
| 14 | EndDate | date | N |  |  |
| 15 | StartHour | decimal(18,0) | Y |  |  |
| 16 | EndHour | decimal(18,0) | Y |  |  |
| 17 | PersonelID | int | Y |  |  |
| 18 | LeaveBalance | decimal(18,0) | N | ((0)) |  |
| 19 | RequestedLeave | decimal(18,0) | N | ((0)) |  |
| 20 | FinalBalance | decimal(18,0) | N | ((0)) |  |
| 21 | ReviewDate | datetime | Y |  |  |
| 22 | ReviewerID | int | Y |  |  |
| 23 | LeaveEntityType | tinyint | N | ((1)) |  |

- **Primary key:** LeaveRequestID
- **FK** `FK_LeaveRequest_RequestType` (RequestTypeID) -> ATN.RequestType (RequestTypeID)
- **FK** `FK_LeaveRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_LeaveRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LeaveRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LeaveRequest_Reviewer` (ReviewerID) -> CFG.User (UserID)

### ATN.MissionReport

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MissionReportID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | MissionRequestID | int | N |  |  |
| 5 | MissionTypeID | int | N |  |  |
| 6 | StartDate | date | N |  |  |
| 7 | EndDate | date | N |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | PersonelID | int | N |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** MissionReportID
- **FK** `FK_MissionReport_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_MissionReport_MissionRequest` (MissionRequestID) -> ATN.MissionRequest (MissionRequestID)
- **FK** `FK_MissionReport_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MissionReport_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MissionReport_MissionType` (MissionTypeID) -> ATN.MissionType (MissionTypeID)

### ATN.MissionRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MissionRequestID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | RequestTypeID | int | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | Status | tinyint | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | StartDate | date | N |  |  |
| 14 | EndDate | date | N |  |  |
| 15 | StartHour | decimal(18,0) | Y |  |  |
| 16 | EndHour | decimal(18,0) | Y |  |  |
| 17 | PersonelID | int | Y |  |  |
| 18 | EffectiveDate | date | Y |  |  |

- **Primary key:** MissionRequestID
- **FK** `FK_MissionRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_MissionRequest_RequestType` (RequestTypeID) -> ATN.RequestType (RequestTypeID)
- **FK** `FK_MissionRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MissionRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.MissionReport (MissionRequestID); HRM.CostRegistrationItem (MissionRequestID)

### ATN.MissionType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MissionTypeID | int | N |  | identity |
| 2 | RequestTypeID | int | N |  |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** MissionTypeID
- **FK** `FK_MissionType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MissionType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MissionType_RequestType` (RequestTypeID) -> ATN.RequestType (RequestTypeID)
- **Referenced by:** ATN.MissionReport (MissionTypeID)

### ATN.PayParameterCalculationResult

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PayParameterCalculationResultID | decimal(18,0) | N |  | identity |
| 2 | ParameterID | int | Y |  |  |
| 3 | Value | decimal(30,10) | N | ((0)) |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | AttendanceCalculationPersonnelID | int | N |  |  |
| 10 | AttendanceParameterID | int | Y |  |  |

- **Primary key:** PayParameterCalculationResultID
- **FK** `FK_PayParameterCalculationResult_AttendanceCalculationPersonnel` (AttendanceCalculationPersonnelID) -> ATN.AttendanceCalculationPersonnel (AttendanceCalculationPersonnelID) on delete CASCADE
- **FK** `FK_PayParameterCalculationResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PayParameterCalculationResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PayParameterCalculationResult_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_PayParameterCalculationResult_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)

### ATN.PersonelAttendanceDevice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelAttendanceDeviceID | int | N |  | identity |
| 2 | AttendanceDeviceID | int | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | IsSent | bit | N | ((0)) |  |

- **Primary key:** PersonelAttendanceDeviceID
- **FK** `FK_PersonelAttendanceDevice_AttendanceDevice` (AttendanceDeviceID) -> ATN.AttendanceDevice (AttendanceDeviceID)
- **FK** `FK_PersonelAttendanceDevice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelAttendanceDevice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelAttendanceDevice_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### ATN.PersonelRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonelRequestID | int | N |  | identity |
| 2 | PersonelID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | RequestTypeID | int | N |  |  |
| 6 | StartDate | date | N |  |  |
| 7 | EndDate | date | N |  |  |
| 8 | StartHour | decimal(18,0) | Y |  |  |
| 9 | EndHour | decimal(18,0) | Y |  |  |
| 10 | Description | nvarchar(MAX) | Y |  |  |
| 11 | Description2 | nvarchar(MAX) | Y |  |  |
| 12 | Status | tinyint | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PersonelRequestID
- **FK** `FK_PersonelRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonelRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonelRequest_RequestType` (RequestTypeID) -> ATN.RequestType (RequestTypeID)
- **FK** `FK_PersonelRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### ATN.PersonnelShiftAssignmentItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PersonnelShiftAssignmentItemID | int | N |  | identity |
| 2 | RowIndex | smallint | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Date | datetime | N |  |  |
| 10 | AttendanceShiftID | int | N |  |  |

- **Primary key:** PersonnelShiftAssignmentItemID
- **FK** `FK_PersonnelShiftAssignmentItem_AttendanceShift` (AttendanceShiftID) -> ATN.AttendanceShift (AttendanceShiftID)
- **FK** `FK_PersonnelShiftAssignmentItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PersonnelShiftAssignmentItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PersonnelShiftAssignmentItem_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### ATN.RequestType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RequestTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | Timing | tinyint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | VacancyNatureID | int | Y |  |  |

- **Primary key:** RequestTypeID
- **FK** `FK_RequestType_VacancyNature` (VacancyNatureID) -> ATN.VacancyNature (VacancyNatureID)
- **FK** `FK_RequestType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RequestType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.LeaveRequest (RequestTypeID); ATN.MissionRequest (RequestTypeID); ATN.MissionType (RequestTypeID); ATN.PersonelRequest (RequestTypeID)

### ATN.VacancyEdition

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyEditionID | int | N |  | identity |
| 2 | VacancyNatureID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | Value | int | N |  |  |
| 6 | ValueType | tinyint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VacancyEditionID
- **FK** `FK_VacancyEdition_VacancyNature` (VacancyNatureID) -> ATN.VacancyNature (VacancyNatureID)
- **FK** `FK_VacancyEdition_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_VacancyEdition_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_VacancyEdition_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyEdition_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.VacancyEstablishment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyEstablishmentID | int | N |  | identity |
| 2 | VacancyNatureID | int | N |  |  |
| 3 | CalendarMonthID | int | N |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | Value | int | N |  |  |
| 6 | ValueType | tinyint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VacancyEstablishmentID
- **FK** `FK_VacancyEstablishment_VacancyNature` (VacancyNatureID) -> ATN.VacancyNature (VacancyNatureID)
- **FK** `FK_VacancyEstablishment_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)
- **FK** `FK_VacancyEstablishment_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_VacancyEstablishment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyEstablishment_LastEditor` (LastEditor) -> CFG.User (UserID)

### ATN.VacancyNature

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyNatureID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | BalanceTiming | tinyint | N |  |  |
| 5 | AccrueTime | tinyint | N |  |  |
| 6 | BalanceEstablish | bit | N |  |  |
| 7 | TransferBalance | bit | N |  |  |
| 8 | AttendanceParameterID | int | N |  |  |
| 9 | UsageThrough | tinyint | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VacancyNatureID
- **FK** `FK_VacancyNature_AttendanceParameter` (AttendanceParameterID) -> ATN.AttendanceParameter (AttendanceParameterID)
- **FK** `FK_VacancyNature_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyNature_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.RequestType (VacancyNatureID); ATN.VacancyEdition (VacancyNatureID); ATN.VacancyEstablishment (VacancyNatureID); ATN.VacancyType (VacancyNatureID)

### ATN.VacancyType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyTypeID | int | N |  | identity |
| 2 | VacancyNatureID | int | Y |  |  |
| 3 | Title | nvarchar(MAX) | N |  |  |
| 4 | Title2 | nvarchar(MAX) | N |  |  |
| 5 | AssignableValue | int | N |  |  |
| 6 | TransferLimitType | tinyint | N |  |  |
| 7 | TransferLimitValue | int | Y |  |  |
| 8 | AssignDependency | tinyint | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VacancyTypeID
- **FK** `FK_VacancyType_VacancyNature` (VacancyNatureID) -> ATN.VacancyNature (VacancyNatureID)
- **FK** `FK_VacancyType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ATN.VacancyTypeAssignmentItem (VacancyTypeID); ATN.VacancyTypeItem (VacancyTypeID)

### ATN.VacancyTypeAssignmentItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyTypeAssignmentItemID | int | N |  | identity |
| 2 | RowIndex | smallint | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | CalendarMonthID | int | N |  |  |
| 5 | VacancyTypeID | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** VacancyTypeAssignmentItemID
- **FK** `FK_VacancyTypeAssignmentItem_VacancyType` (VacancyTypeID) -> ATN.VacancyType (VacancyTypeID)
- **FK** `FK_VacancyTypeAssignmentItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyTypeAssignmentItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VacancyTypeAssignmentItem_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_VacancyTypeAssignmentItem_CalendarMonth` (CalendarMonthID) -> HRM.CalendarMonth (CalendarMonthID)

### ATN.VacancyTypeItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VacancyTypeItemID | int | N |  | identity |
| 2 | VacancyTypeID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | AllowToNegativeUse | bit | N |  |  |
| 6 | NegativeLimit | int | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VacancyTypeItemID
- **FK** `FK_VacancyTypeItem_VacancyType` (VacancyTypeID) -> ATN.VacancyType (VacancyTypeID) on delete CASCADE
- **FK** `FK_VacancyTypeItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VacancyTypeItem_LastEditor` (LastEditor) -> CFG.User (UserID)

## Views

### ATN.vwAttendanceShift

Definition: `programmability/views/ATN.vwAttendanceShift.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AttendanceShiftID | int | N |
| 2 | Code | int | N |
| 3 | Title | nvarchar(256) | N |
| 4 | AttendanceShiftItemID | int | N |
| 5 | RowIndex | smallint | N |
| 6 | Day | tinyint | N |
| 7 | EndDay | int | N |
| 8 | StartingLimitHour | decimal(21,10) | Y |
| 9 | ShiftStartingHour | decimal(21,10) | Y |
| 10 | StartHour | decimal(18,10) | Y |
| 11 | EndHour | decimal(18,10) | Y |
| 12 | EndingLimitHour | decimal(21,10) | Y |
| 13 | ShiftEndingHour | decimal(21,10) | Y |
| 14 | StartDate | date | N |
| 15 | EndDate | date | Y |
| 16 | VacancyDuration | int | Y |
| 17 | DayType | tinyint | Y |
| 18 | IsWorkingDay | int | N |

### ATN.vwPersonelManager

Definition: `programmability/views/ATN.vwPersonelManager.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | ManagerID | int | N |

### ATN.vwPersonelShiftInDate

Definition: `programmability/views/ATN.vwPersonelShiftInDate.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AttendanceShiftID | int | N |
| 2 | PersonnelShiftAssignmentItemID | int | N |
| 3 | PersonelID | int | N |
| 4 | Date | date | N |

### ATN.vwPersonelStandardEntryAndExit

Definition: `programmability/views/ATN.vwPersonelStandardEntryAndExit.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AttendanceShiftID | int | N |
| 2 | Code | int | N |
| 3 | Title | nvarchar(256) | N |
| 4 | AttendanceShiftItemID | int | N |
| 5 | RowIndex | smallint | N |
| 6 | Day | tinyint | N |
| 7 | EndDay | int | N |
| 8 | StartingLimitHour | decimal(21,10) | Y |
| 9 | ShiftStartingHour | decimal(21,10) | Y |
| 10 | StartHour | decimal(18,10) | Y |
| 11 | EndHour | decimal(18,10) | Y |
| 12 | EndingLimitHour | decimal(21,10) | Y |
| 13 | ShiftEndingHour | decimal(21,10) | Y |
| 14 | StartDate | date | N |
| 15 | EndDate | date | Y |
| 16 | VacancyDuration | int | Y |
| 17 | DayType | tinyint | Y |
| 18 | PersonelID | int | N |

### ATN.vwPersonelVacancyTypeInMonth

Definition: `programmability/views/ATN.vwPersonelVacancyTypeInMonth.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | N |
| 2 | CalendarMonthID | int | N |
| 3 | AttendanceStartDate | date | Y |
| 4 | AttendanceEndDate | date | Y |
| 5 | VacancyTypeID | int | N |
| 6 | VacancyNatureID | int | Y |
| 7 | Title | nvarchar(MAX) | N |
| 8 | AssignableValue | int | N |
| 9 | AllowToNegativeUse | bit | N |
| 10 | NegativeLimit | int | Y |
| 11 | AccrueTime | tinyint | N |
| 12 | TransferBalance | bit | N |
| 13 | AssignDependency | tinyint | N |

### ATN.vwVacancyCardex

Definition: `programmability/views/ATN.vwVacancyCardex.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PersonelID | int | Y |
| 2 | VacancyNatureID | int | Y |
| 3 | Date | date | Y |
| 4 | AddedVacancy | int | Y |
| 5 | DeductedVacancy | int | Y |
| 6 | Document | varchar(20) | N |
| 7 | DocumentID | int | Y |
| 8 | EmploymentDate | date | N |

