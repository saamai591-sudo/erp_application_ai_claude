# Schema `EDU`

## Tables

### EDU.CheckExam

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CheckExamID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |

- **Primary key:** CheckExamID
- **FK** `FK_CheckExam_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_CheckExam_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CheckExam_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CheckExamItem (CheckExamID)

### EDU.CheckExamItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CheckExamItemID | int | N |  | identity |
| 2 | CheckExamID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | CourseRegistrationItemID | int | N |  |  |
| 5 | State | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** CheckExamItemID
- **FK** `FK_CheckExamItem_CheckExam` (CheckExamID) -> EDU.CheckExam (CheckExamID) on delete CASCADE
- **FK** `FK_CheckExamItem_CourseRegistrationItem` (CourseRegistrationItemID) -> EDU.CourseRegistrationItem (CourseRegistrationItemID)
- **FK** `FK_CheckExamItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CheckExamItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CostElement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostElementID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Code | nvarchar(256) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CostElementID
- **FK** `FK_CostElement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostElement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseCostEstimationItem (CostElementID)

### EDU.Course

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseID | int | N |  | identity |
| 2 | CourseTypeID | int | N |  |  |
| 3 | Code | nvarchar(256) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Description | nvarchar(2048) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Description2 | nvarchar(2048) | Y |  |  |

- **Primary key:** CourseID
- **FK** `FK_Course_CourseType` (CourseTypeID) -> EDU.CourseType (CourseTypeID)
- **FK** `FK_Course_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Course_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseExamType (CourseID); EDU.CoursePlaningConditionCourse (CourseID); EDU.CoursePlanning (CourseID); EDU.CourseRequest (CourseID)

### EDU.CourseCostEstimation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseCostEstimationID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |

- **Primary key:** CourseCostEstimationID
- **FK** `FK_CourseCostEstimation_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_CourseCostEstimation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseCostEstimation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseCostEstimationItem (CourseCostEstimationID)

### EDU.CourseCostEstimationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseCostEstimationItemID | int | N |  | identity |
| 2 | CourseCostEstimationID | int | N |  |  |
| 3 | CostElementID | int | N |  |  |
| 4 | Cost | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CourseCostEstimationItemID
- **FK** `FK_CourseCostEstimationItem_CostElement` (CostElementID) -> EDU.CostElement (CostElementID)
- **FK** `FK_CourseCostEstimationItem_CourseCostEstimation` (CourseCostEstimationID) -> EDU.CourseCostEstimation (CourseCostEstimationID) on delete CASCADE
- **FK** `FK_CourseCostEstimationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseCostEstimationItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CourseExamType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseExamTypeID | int | N |  | identity |
| 2 | CourseID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | AcceptanceCriteriaType | tinyint | N |  |  |
| 6 | AcceptanceAverage | decimal(18,4) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** CourseExamTypeID
- **FK** `FK_CourseExamType_Course` (CourseID) -> EDU.Course (CourseID)
- **FK** `FK_CourseExamType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseExamType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseExamTypeItem (CourseExamTypeID); EDU.CoursePlanning (CourseExamTypeID)

### EDU.CourseExamTypeItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseExamTypeItemID | int | N |  | identity |
| 2 | CourseExamTypeID | int | N |  |  |
| 3 | ItemIndex | int | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Title | nvarchar(256) | N |  |  |
| 6 | Description | nvarchar(1024) | Y |  |  |
| 7 | Ratio | decimal(18,4) | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** CourseExamTypeItemID
- **FK** `FK_CourseExamTypeItem_CourseExamType` (CourseExamTypeID) -> EDU.CourseExamType (CourseExamTypeID) on delete CASCADE
- **FK** `FK_CourseExamTypeItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseExamTypeItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseExamTypeItemFormula (CourseExamTypeItemID); EDU.CoursePlaningResultScore (CourseExamTypeItemID)

### EDU.CourseExamTypeItemFormula

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseExamTypeItemFormulaID | int | N |  | identity |
| 2 | CourseExamTypeItemID | int | N |  |  |
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

- **Primary key:** CourseExamTypeItemFormulaID
- **FK** `FK_CourseExamTypeItemFormula_CourseExamTypeItem` (CourseExamTypeItemID) -> EDU.CourseExamTypeItem (CourseExamTypeItemID)
- **FK** `FK_CourseExamTypeItemFormula_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseExamTypeItemFormula_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CourseLocation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseLocationID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CourseLocationID
- **FK** `FK_CourseLocation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseLocation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CoursePlaningItem (CourseLocationID)

### EDU.CoursePlaningCondition

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | HasMale | bit | N |  |  |
| 4 | HasFemale | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionID
- **FK** `FK_CoursePlaningCondition_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_CoursePlaningCondition_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningCondition_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CoursePlaningConditionCourse (CoursePlaningConditionID); EDU.CoursePlaningConditionEmploymentType (CoursePlaningConditionID); EDU.CoursePlaningConditionFlowChart (CoursePlaningConditionID); EDU.CoursePlaningConditionJob (CoursePlaningConditionID); EDU.CoursePlaningConditionPosition (CoursePlaningConditionID); EDU.CoursePlaningConditionStudyDegree (CoursePlaningConditionID); EDU.CoursePlaningConditionStudyField (CoursePlaningConditionID)

### EDU.CoursePlaningConditionCourse

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionCourseID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | CourseID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionCourseID
- **FK** `FK_CoursePlaningConditionCourse_Course` (CourseID) -> EDU.Course (CourseID)
- **FK** `FK_CoursePlaningConditionCourse_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionCourse_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionCourse_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CoursePlaningConditionEmploymentType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionEmploymentTypeID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | EmploymentTypeID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionEmploymentTypeID
- **FK** `FK_CoursePlaningConditionEmploymentType_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionEmploymentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionEmploymentType_EmploymentType` (EmploymentTypeID) -> HRM.EmploymentType (EmploymentTypeID)
- **FK** `FK_CoursePlaningConditionEmploymentType_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CoursePlaningConditionFlowChart

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionFlowChartID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | FlowChartID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionFlowChartID
- **FK** `FK_CoursePlaningConditionFlowChart_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionFlowChart_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionFlowChart_FlowChart` (FlowChartID) -> HRM.FlowChart (FlowChartID)
- **FK** `FK_CoursePlaningConditionFlowChart_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CoursePlaningConditionJob

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionJobID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | JobID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionJobID
- **FK** `FK_CoursePlaningConditionJob_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionJob_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionJob_Job` (JobID) -> HRM.Job (JobID)
- **FK** `FK_CoursePlaningConditionJob_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CoursePlaningConditionPosition

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionPositionID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | PositionID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionPositionID
- **FK** `FK_CoursePlaningConditionPosition_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionPosition_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionPosition_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionPosition_Position` (PositionID) -> HRM.Position (PositionID)

### EDU.CoursePlaningConditionStudyDegree

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionStudyDegreeID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | StudyDegreeID | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionStudyDegreeID
- **FK** `FK_CoursePlaningConditionStudyDegree_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionStudyDegree_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionStudyDegree_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionStudyDegree_StudyDegree` (StudyDegreeID) -> HRM.StudyDegree (StudyDegreeID)

### EDU.CoursePlaningConditionStudyField

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningConditionStudyFieldID | int | N |  | identity |
| 2 | CoursePlaningConditionID | int | N |  |  |
| 3 | StudyFieldID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CoursePlaningConditionStudyFieldID
- **FK** `FK_CoursePlaningConditionStudyField_CoursePlaningCondition` (CoursePlaningConditionID) -> EDU.CoursePlaningCondition (CoursePlaningConditionID) on delete CASCADE
- **FK** `FK_CoursePlaningConditionStudyField_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionStudyField_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningConditionStudyField_StudyField` (StudyFieldID) -> HRM.StudyField (StudyFieldID)

### EDU.CoursePlaningItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningItemID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | ItemIndex | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | StartTime | time(7) | N |  |  |
| 6 | EndTime | time(7) | N |  |  |
| 7 | TeacherID | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | CourseLocationID | int | N |  |  |

- **Primary key:** CoursePlaningItemID
- **FK** `FK_CoursePlaningItem_CourseLocation` (CourseLocationID) -> EDU.CourseLocation (CourseLocationID)
- **FK** `FK_CoursePlaningItem_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID) on delete CASCADE
- **FK** `FK_CoursePlaningItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningItem_Teacher` (TeacherID) -> EDU.Teacher (TeacherID)
- **Referenced by:** EDU.Rollcall (CoursePlaningItemID)

### EDU.CoursePlaningResult

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningResultID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | RowIndex | smallint | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** CoursePlaningResultID
- **FK** `FK_CoursePlaningResult_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_CoursePlaningResult_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningResult_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningResult_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** EDU.CoursePlaningResultScore (CoursePlaningResultID)

### EDU.CoursePlaningResultScore

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlaningResultScoreID | int | N |  | identity |
| 2 | CoursePlaningResultID | int | N |  |  |
| 3 | CourseExamTypeItemID | int | N |  |  |
| 4 | Score | decimal(10,2) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CoursePlaningResultScoreID
- **FK** `FK_CoursePlaningResultScore_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningResultScore_CourseExamTypeItem` (CourseExamTypeItemID) -> EDU.CourseExamTypeItem (CourseExamTypeItemID)
- **FK** `FK_CoursePlaningResultScore_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlaningResultScore_CoursePlaningResult` (CoursePlaningResultID) -> EDU.CoursePlaningResult (CoursePlaningResultID) on delete CASCADE

### EDU.CoursePlanning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CoursePlanningID | int | N |  | identity |
| 2 | CourseID | int | N |  |  |
| 3 | CourseExamTypeID | int | Y |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | StartDate | date | N |  |  |
| 7 | HasExam | bit | N |  |  |
| 8 | HasCertificate | bit | N |  |  |
| 9 | CoursePlaningType | tinyint | N |  |  |
| 10 | Description | nvarchar(2048) | Y |  |  |
| 11 | Status | tinyint | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |

- **Primary key:** CoursePlanningID
- **FK** `FK_CoursePlanning_Course` (CourseID) -> EDU.Course (CourseID)
- **FK** `FK_CoursePlanning_CourseExamType` (CourseExamTypeID) -> EDU.CourseExamType (CourseExamTypeID)
- **FK** `FK_CoursePlanning_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CoursePlanning_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CheckExam (CoursePlanningID); EDU.CourseCostEstimation (CoursePlanningID); EDU.CoursePlaningCondition (CoursePlanningID); EDU.CoursePlaningItem (CoursePlanningID); EDU.CoursePlaningResult (CoursePlanningID); EDU.CourseRegistration (CoursePlanningID); EDU.CourseRequestCoursePlaning (CoursePlanningID); EDU.Rollcall (CoursePlanningID)

### EDU.CourseRegistration

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseRegistrationID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |

- **Primary key:** CourseRegistrationID
- **FK** `FK_CourseRegistration_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_CourseRegistration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseRegistration_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseRegistrationItem (CourseRegistrationID)

### EDU.CourseRegistrationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseRegistrationItemID | int | N |  | identity |
| 2 | CourseRegistrationID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PartyID | bigint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CourseRegistrationItemID
- **FK** `FK_CourseRegistrationItem_CourseRegistration` (CourseRegistrationID) -> EDU.CourseRegistration (CourseRegistrationID) on delete CASCADE
- **FK** `FK_CourseRegistrationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseRegistrationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CourseRegistrationItem_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** EDU.CheckExamItem (CourseRegistrationItemID); EDU.RollcallItem (CourseRegistrationItemID)

### EDU.CourseRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseRequestID | int | N |  | identity |
| 2 | CourseID | int | N |  |  |
| 3 | OrganizationUnitID | int | N |  |  |
| 4 | Number | varchar(50) | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Description | nvarchar(2048) | Y |  |  |
| 7 | CourseTopics | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | Status | tinyint | N |  |  |

- **Primary key:** CourseRequestID
- **FK** `FK_CourseRequest_Course` (CourseID) -> EDU.Course (CourseID)
- **FK** `FK_CourseRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CourseRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **Referenced by:** EDU.CourseRequestCoursePlaning (CourseRequestID)

### EDU.CourseRequestCoursePlaning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseRequestCoursePlaningID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | CourseRequestID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CourseRequestCoursePlaningID
- **FK** `FK_CourseRequestCoursePlaning_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID) on delete CASCADE
- **FK** `FK_CourseRequestCoursePlaning_CourseRequest` (CourseRequestID) -> EDU.CourseRequest (CourseRequestID)
- **FK** `FK_CourseRequestCoursePlaning_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseRequestCoursePlaning_LastEditor` (LastEditor) -> CFG.User (UserID)

### EDU.CourseType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CourseTypeID | int | N |  | identity |
| 2 | Code | nvarchar(256) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CourseTypeID
- **FK** `FK_CourseType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_CourseType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.Course (CourseTypeID)

### EDU.Rollcall

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RollcallID | int | N |  | identity |
| 2 | CoursePlanningID | int | N |  |  |
| 3 | CoursePlaningItemID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** RollcallID
- **FK** `FK_Rollcall_CoursePlaningItem` (CoursePlaningItemID) -> EDU.CoursePlaningItem (CoursePlaningItemID)
- **FK** `FK_Rollcall_CoursePlanning` (CoursePlanningID) -> EDU.CoursePlanning (CoursePlanningID)
- **FK** `FK_Rollcall_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Rollcall_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.RollcallItem (RollcallID)

### EDU.RollcallItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RollcallItemID | int | N |  | identity |
| 2 | RollcallID | int | N |  |  |
| 3 | CourseRegistrationItemID | int | N |  |  |
| 4 | Present | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** RollcallItemID
- **FK** `FK_RollcallItem_CourseRegistrationItem` (CourseRegistrationItemID) -> EDU.CourseRegistrationItem (CourseRegistrationItemID)
- **FK** `FK_RollcallItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RollcallItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RollcallItem_Rollcall` (RollcallID) -> EDU.Rollcall (RollcallID) on delete CASCADE

### EDU.Teacher

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TeacherID | int | N |  | identity |
| 2 | PartyID | bigint | N |  |  |
| 3 | Code | nvarchar(50) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** TeacherID
- **FK** `FK_Teacher_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Teacher_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Teacher_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** EDU.CoursePlaningItem (TeacherID); EDU.TeacherEducation (TeacherID); EDU.TeacherExperience (TeacherID); EDU.TeacherSchooling (TeacherID)

### EDU.TeacherEducation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TeacherEducationID | int | N |  | identity |
| 2 | TeacherID | int | N |  |  |
| 3 | InstituteName | nvarchar(256) | N |  |  |
| 4 | CourseTitle | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** TeacherEducationID
- **FK** `FK_TeacherEducation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TeacherEducation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TeacherEducation_Teacher` (TeacherID) -> EDU.Teacher (TeacherID) on delete CASCADE

### EDU.TeacherExperience

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TeacherExperienceID | int | N |  | identity |
| 2 | TeacherID | int | N |  |  |
| 3 | CompanyName | nvarchar(256) | N |  |  |
| 4 | WorkPositionTitle | nvarchar(256) | N |  |  |
| 5 | WorkYear | varchar(4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** TeacherExperienceID
- **FK** `FK_TeacherExperience_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TeacherExperience_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TeacherExperience_Teacher` (TeacherID) -> EDU.Teacher (TeacherID) on delete CASCADE

### EDU.TeacherSchooling

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TeacherSchoolingID | int | N |  | identity |
| 2 | TeacherID | int | N |  |  |
| 3 | InstituteName | nvarchar(256) | N |  |  |
| 4 | StudyDegreeTitle | nvarchar(256) | N |  |  |
| 5 | StudyFieldIDTitle | nvarchar(256) | N |  |  |
| 6 | InDate | date | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** TeacherSchoolingID
- **FK** `FK_TeacherSchooling_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TeacherSchooling_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TeacherSchooling_Teacher` (TeacherID) -> EDU.Teacher (TeacherID) on delete CASCADE

