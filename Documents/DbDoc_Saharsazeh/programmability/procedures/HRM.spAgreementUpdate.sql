

CREATE     PROC HRM.spAgreementUpdate
    @AgreementID INT ,
    @AgreementTypeID TINYINT ,
    @EmploymentStatusID TINYINT ,
    @ConfirmDate DATE ,
    @PersonelID INT ,
    @Number INT ,
    @IssueDate DATE ,
    @ExecuteDate DATE ,
    @EmploymentDate DATE ,
    @ExpireDate DATE ,
    @EmploymentTypeID INT ,
    @WorkPlaceID INT ,
    @CostCenterID INT ,
    @PositionID INT ,
    @JobID INT ,
    @Specification NVARCHAR(MAX) ,
    @Specification2 NVARCHAR(MAX) ,
    @ConfirmedBy INT ,
    @PayrollGroupID INT ,
    @PayrollBaseID INT ,
    @OccupationGradeID INT ,
    @Serial INT ,
    @ExperienceLen INT ,
    @BranchID INT ,
    @OrganizationUnitID   INT,
    @IsManagerToOrganizationUnit   BIT,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME

--WITH ENCRYPTION 
AS
SET NOCOUNT ON; 
IF @Version = (
       SELECT [Version]
       FROM   [HRM].[Agreement]
       WHERE  [AgreementID] = @AgreementID
				)
BEGIN
    DECLARE @oldIssueDate DATE,
            @NeedConfirm                   BIT,
            @AggTypeNeedConfirm            BIT
    
    SELECT @oldIssueDate = a.IssueDate
    FROM   HRM.Agreement a
    WHERE  a.AgreementID = @AgreementID;
    
    SELECT @NeedConfirm = ConfigValue
    FROM   CFG.Configuration c
    WHERE  c.ConfigKey = 'AgreementNeedConfirm';
    
    SELECT @AggTypeNeedConfirm = at.NeedConfirmation
    FROM   HRM.AgreementType AS at
    WHERE  at.AgreementTypeID = @AgreementTypeID;
    
    EXEC hrm.spAgreementControls
    	@AgreementID = @AgreementID,
    	@Type = 2,
    	@BranchID = @BranchID,
    	@IssueDate = @IssueDate,
    	@ExecuteDate = @ExecuteDate,
    	@PersonelID = @PersonelID,
    	@ConfirmDate = @ConfirmDate,
    	@AgreementTypeID = @AgreementTypeID
    
    IF (@Number IS NULL)
       OR @Number = 0
        SET @Number = ISNULL(
                (
                    SELECT MAX(a.Number)
                    FROM   HRM.Agreement a
                ),
                0
            ) + 1;
    
    SET @Serial = [HRM].[GetNewAgreementSerial](@PersonelID, @AgreementTypeID, @IssueDate, @AgreementID);
    
    UPDATE [HRM].[Agreement]
    SET    [AgreementTypeID]      = @AgreementTypeID,
           EmploymentStatusID     = @EmploymentStatusID,
           ConfirmDate            = @ConfirmDate,
           [PersonelID]           = @PersonelID,
           [Number]               = @Number,
           [IssueDate]            = @IssueDate,
           [ExecuteDate]          = @ExecuteDate,
           [EmploymentDate]       = @EmploymentDate,
           [ExpireDate]           = @ExpireDate,
           [EmploymentTypeID]     = @EmploymentTypeID,
           [WorkPlaceID]          = @WorkPlaceID,
           [CostCenterID]         = @CostCenterID,
           [PositionID]           = @PositionID,
           [JobID]                = @JobID,
           [Specification]        = @Specification,
           [Specification2]       = @Specification2,
           [ConfirmedBy]          = @ConfirmedBy,
           [Version]              = @Version,
           [Creator]              = @Creator,
           [CreationDate]         = @CreationDate,
           [LastEditor]           = @LastEditor,
           [LastEditionDate]      = @LastEditionDate,
           PayrollGroupID         = @PayrollGroupID,
           PayrollBaseID          = @PayrollBaseID,
           OccupationGradeID      = @OccupationGradeID,
           Serial                 = @Serial,
           ExperienceLen          = @ExperienceLen,
           BranchID               = @BranchID,
           OrganizationUnitID     = @OrganizationUnitID,
           IsManagerToOrganizationUnit = @IsManagerToOrganizationUnit
    WHERE  [AgreementID]          = @AgreementID;
    
    -- Begin Return Select <- do not remove
    SELECT [Version],
           [Number],
           Serial 
	FROM   [HRM].[Agreement]
    WHERE  [AgreementID] = @AgreementID; 
    -- End Return Select <- do not remove
END;
