CREATE PROC [HRM].[SpBaseValueDataInsert] 
    @BaseValueID INT,
    @PaymentSystemID INT,
    @ApplyDate DATE,
    @IssueDate DATE,
    @GroupID INT = NULL,
    @BaseID INT = NULL,
    @OccupationGradeID INT = NULL,
    @JobID INT = NULL,
    @JobGroupID INT = NULL,
    @PersonelID INT = NULL,
    @Value DECIMAL(18, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
	
    DECLARE @MinValue DECIMAL(18,4),@MaxValue DECIMAL(18,4)
    SELECT @MinValue=MinValue,@MaxValue=MaxValue FROM hrm.BaseValue
    WHERE BaseValueID=@BaseValueID

    IF (@MinValue IS NOT NULL AND @Value<@MinValue)
    BEGIN
	    RAISERROR('مقدار وارد شده از حداقل مقدار مجاز کوچکتر می باشد.', 16, 12)
        RETURN;
    End 

    IF (@MaxValue IS NOT NULL AND @Value>@MaxValue)
    BEGIN
	    RAISERROR('مقدار وارد شده از حداکثر مقدار مجاز بزرگتر می باشد.', 16, 12)
        RETURN;
    End 
	
	
    IF EXISTS (
	
	    SELECT 1 FROM hrm.BaseValueData AS bvd
	    WHERE bvd.BaseValueID=@BaseValueID
	    AND bvd.PaymentSystemID=@PaymentSystemID
	    AND bvd.IssueDate=@IssueDate
	    AND ( bvd.GroupID=@GroupID OR @GroupID IS null)
	    AND ( bvd.BaseID=@BaseID OR @BaseID IS null)
	    AND ( bvd.OccupationGradeID=@OccupationGradeID OR OccupationGradeID IS null)
	    AND ( bvd.JobID=@JobID OR @JobID IS null)
	    AND ( bvd.PersonelID=@PersonelID OR @PersonelID IS null)
	    AND ( bvd.JobGroupID=@JobGroupID OR @JobGroupID IS null)
    )
    BEGIN
	     RAISERROR(
            'اطلاعات تکراري مي باشد.',
            16,
            12
	     )
	     return
    END	
	
    DECLARE @MaxIssueDate DATE

    SELECT @MaxIssueDate=MAX(IssueDate)	
    FROM hrm.Agreement AS a
        LEFT JOIN hrm.[Job] AS j
            ON j.JobID = a.JobID
    WHERE 
        ( @PersonelID is null OR a.PersonelID=@PersonelID) AND
        ( @GroupID is null OR a.PayrollGroupID=@groupID) AND
        ( @JObID is null OR a.JobID=@jobID) AND
        ( @BaseID is null OR a.PayrollBaseID=@BaseID) AND
        ( @OccupationGradeID is null OR a.OccupationGradeID=@OccupationGradeID) AND
        ( @JobGroupID is null OR j.[group]=@JobGroupID) 

    IF @MaxIssueDate>=@IssueDate
    BEGIN
        RAISERROR(
            'با توجه به اينکه بعد از تاريخ صدور مورد نظر قرارداد صادر شده است امکان درج مقادبر نمي باشد.',
            16,
            12
        )
        RETURN
    END
	
    INSERT INTO [HRM].[BaseValueData]
      (
        [BaseValueID],
        [PaymentSystemID],
        [ApplyDate],
        IssueDate,
        [GroupID],
        [BaseID],
        [OccupationGradeID],
        [JobID],JobGroupId,
        [PersonelID],
        [Value],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @BaseValueID,
           @PaymentSystemID,
           @ApplyDate,
           @IssueDate,
           @GroupID,
           @BaseID,
           @OccupationGradeID,
           @JobID,@JobGroupID,
           @PersonelID,
           @Value,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	-- Begin Return Select <- do not remove
    SELECT [BaseValueDataID],
           [Version]
    FROM   [HRM].[BaseValueData]
    WHERE  [BaseValueDataID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
