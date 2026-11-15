

CREATE     PROC [HRM].spAgreementInsert
    @AgreementTypeID TINYINT,
    @EmploymentStatusID TINYINT,
    @ConfirmDate DATE,
    @PersonelID INT,
    @Number INT,
    @IssueDate DATE,
    @ExecuteDate DATE,
    @EmploymentDate DATE,
    @ExpireDate DATE,
    @EmploymentTypeID INT,
    @WorkPlaceID INT,
    @CostCenterID INT,
    @PositionID INT,
    @JobID INT,   
    @Specification NVARCHAR(MAX),
    @Specification2 NVARCHAR(MAX),
    @ConfirmedBy INT,
    @PayrollGroupID  INT,
    @PayrollBaseID  INT,
    @OccupationGradeID INT,
    @Serial INT,
    @ExperienceLen INT,
    @BranchID   INT,
    @OrganizationUnitID   INT,
    @IsManagerToOrganizationUnit   BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 	

EXEC hrm.spAgreementControls
	@AgreementID = null,
	@Type = 1,
	@BranchID = @BranchID,
	@IssueDate = @IssueDate,
	@ExecuteDate = @ExecuteDate,
	@PersonelID = @PersonelID,
	@ConfirmDate = @ConfirmDate,
	@AgreementTypeID = @AgreementTypeID
	
SET @Serial = [HRM].[GetNewAgreementSerial](@PersonelID, @AgreementTypeID, @IssueDate, -1)

IF (@Number IS NULL)
   OR @Number = 0
    SET @Number = ISNULL(
            (
                SELECT MAX(a.Number)
                FROM   HRM.Agreement a
            ),
            0
        ) + 1
        
INSERT INTO [HRM].[Agreement]
  (
    AgreementTypeID,
    EmploymentStatusID,
    ConfirmDate,
    [PersonelID],
    [Number],
    [IssueDate],
    [ExecuteDate],
    [EmploymentDate],
    [ExpireDate],
    [EmploymentTypeID],
    [WorkPlaceID],
    [CostCenterID],
    [PositionID],
    [JobID],
    [Specification],
    [Specification2],
    [ConfirmedBy],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    PayrollGroupID,
    PayrollBaseID,
    OccupationGradeID,
    Serial,
    ExperienceLen,
    BranchID,
    [OrganizationUnitID],
    [IsManagerToOrganizationUnit]
  )
SELECT @AgreementTypeID,
       @EmploymentStatusID,
       @ConfirmDate,
       @PersonelID,
       @Number,
       @IssueDate,
       @ExecuteDate,
       @EmploymentDate,
       @ExpireDate,
       @EmploymentTypeID,
       @WorkPlaceID,
       @CostCenterID,
       @PositionID,
       @JobID,
       @Specification,
       @Specification2,
       @ConfirmedBy,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       @PayrollGroupID,
       @PayrollBaseID,
       @OccupationGradeID,
       @Serial,
       @ExperienceLen,
       @BranchID,
       @OrganizationUnitID,
       @IsManagerToOrganizationUnit
	
	-- Begin Return Select <- do not remove
SELECT [AgreementID],
       [Version],
       Number,
       Serial
FROM   [HRM].[Agreement]
WHERE  [AgreementID] = SCOPE_IDENTITY()
       -- End Return Select <- do not remove
