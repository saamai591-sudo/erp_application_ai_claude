CREATE PROC [HRM].[SpBaseValueDataUpdate]
    @BaseValueDataID INT ,
    @BaseValueID INT ,
    @PaymentSystemID INT ,
    @ApplyDate DATE ,
    @IssueDate DATE ,
    @GroupID INT = NULL ,
    @BaseID INT = NULL ,
    @OccupationGradeID INT = NULL ,
    @JobID INT = NULL ,
    @JobGroupID INT = NULL ,
    @PersonelID INT = NULL ,
    @Value DECIMAL(18, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 

    DECLARE @OldIssueDate DATE ,
        @OldGroupID INT = NULL ,
        @OldBaseID INT = NULL ,
        @OldOccupationGradeID INT = NULL ,
        @OldJobID INT = NULL ,
        @OldJobGroupID INT = NULL ,
        @OldPersonelID INT = NULL;
	

    DECLARE @MinValue DECIMAL(18, 4) ,
        @MaxValue DECIMAL(18, 4);
    SELECT  @MinValue = MinValue ,
            @MaxValue = MaxValue
    FROM    HRM.BaseValue
    WHERE   BaseValueID = @BaseValueID;

    IF ( @MinValue IS NOT NULL
         AND @Value < @MinValue
       )
        BEGIN
            RAISERROR('مقدار وارد شده از حداقل مقدار مجاز کوچکتر می باشد.', 16, 12);
            RETURN;
        END; 

    IF ( @MaxValue IS NOT NULL
         AND @Value > @MaxValue
       )
        BEGIN
            RAISERROR('مقدار وارد شده از حداکثر مقدار مجاز بزرگتر می باشد.', 16, 12);
            RETURN;
        END; 

    SELECT  @OldIssueDate = IssueDate ,
            @OldGroupID = bvd.GroupID ,
            @OldBaseID = bvd.BaseID ,
            @OldOccupationGradeID = bvd.OccupationGradeID ,
            @OldJobID = bvd.JobID ,
            @OldPersonelID = bvd.PersonelID ,
            @OldJobGroupID = bvd.JobGroupID
    FROM    HRM.BaseValueData AS bvd
    WHERE   bvd.BaseValueDataID = @BaseValueDataID;
	
    IF EXISTS ( SELECT  1
                FROM    HRM.BaseValueData AS bvd
                WHERE   bvd.BaseValueDataID <> @BaseValueDataID
                        AND bvd.BaseValueID = @BaseValueID
                        AND bvd.PaymentSystemID = @PaymentSystemID
                        AND bvd.IssueDate = @IssueDate
                        AND ( bvd.GroupID = @GroupID
                              OR @GroupID IS NULL
                            )
                        AND ( bvd.BaseID = @BaseID
                              OR @BaseID IS NULL
                            )
                        AND ( bvd.OccupationGradeID = @OccupationGradeID
                              OR OccupationGradeID IS NULL
                            )
                        AND ( bvd.JobID = @JobID
                              OR @JobID IS NULL
                            )
                        AND ( bvd.PersonelID = @PersonelID
                              OR @PersonelID IS NULL
                            )
                        AND ( bvd.JobGroupID = @JobGroupID
                              OR @JobGroupID IS NULL
                            ) )
        BEGIN
            RAISERROR( 'اطلاعات تکراري مي باشد.', 16, 12);
        END;	
	
    DECLARE @MaxIssueDate DATE;

    SELECT  @MaxIssueDate = MAX(IssueDate)
    FROM    HRM.Agreement AS a
            LEFT JOIN HRM.[Job] AS j ON j.JobID = a.JobID
    WHERE   ( @PersonelID IS NULL
              OR a.PersonelID = @PersonelID
            )
            AND ( @GroupID IS NULL
                  OR a.PayrollGroupID = @GroupID
                )
            AND ( @JobID IS NULL
                  OR a.JobID = @JobID
                )
            AND ( @BaseID IS NULL
                  OR a.PayrollBaseID = @BaseID
                )
            AND ( @OccupationGradeID IS NULL
                  OR a.OccupationGradeID = @OccupationGradeID
                )
            AND ( @JobGroupID IS NULL
                  OR j.[group] = @JobGroupID
                ); 

    IF @MaxIssueDate >= @IssueDate
        BEGIN
            RAISERROR(N'با توجه به اينکه بعد از تاريخ صدور مورد نظر قرارداد صادر شده است امکان تغيير  مقادبر نمي باشد.', 16, 12 );
            RETURN;
        END;

    SELECT  @MaxIssueDate = MAX(IssueDate)
    FROM    HRM.Agreement AS a
            LEFT JOIN HRM.[Job] AS j ON j.JobID = a.JobID
    WHERE   ( @OldPersonelID IS NULL
              OR a.PersonelID = @OldPersonelID
            )
            AND ( @OldGroupID IS NULL
                  OR a.PayrollGroupID = @OldGroupID
                )
            AND ( @OldJobID IS NULL
                  OR a.JobID = @OldJobID
                )
            AND ( @OldBaseID IS NULL
                  OR a.PayrollBaseID = @OldBaseID
                )
            AND ( @OldOccupationGradeID IS NULL
                  OR a.OccupationGradeID = @OldOccupationGradeID
                )
            AND ( @OldJobGroupID IS NULL
                  OR j.[group] = @OldJobGroupID
                ); 

    IF @MaxIssueDate >= @OldIssueDate
        BEGIN
            RAISERROR(N'با توجه به اينکه بعد از تاريخ صدور مورد نظر قرارداد صادر شده است امکان تغيير  مقادبر نمي باشد.', 16, 12 );
            RETURN;
        END;

    IF @Version <> ( SELECT [Version]
                     FROM   [HRM].[BaseValueData]
                     WHERE  [BaseValueDataID] = @BaseValueDataID
                   )
        BEGIN
            RAISERROR('Version mismatch...', 16, 10);
            RETURN;
        END;


    SET @Version = @Version + 1; 

    UPDATE  [HRM].[BaseValueData]
    SET     [BaseValueID] = @BaseValueID ,
            [PaymentSystemID] = @PaymentSystemID ,
            [ApplyDate] = @ApplyDate ,
            IssueDate = @IssueDate ,
            [GroupID] = @GroupID ,
            [BaseID] = @BaseID ,
            [OccupationGradeID] = @OccupationGradeID ,
            [JobID] = @JobID ,
            JobGroupID = @JobGroupID ,
            [PersonelID] = @PersonelID ,
            [Value] = @Value ,
            [Creator] = @Creator ,
            [CreationDate] = @CreationDate ,
            [LastEditor] = @LastEditor ,
            [LastEditionDate] = @LastEditionDate ,
            [Version] = @Version
    WHERE   [BaseValueDataID] = @BaseValueDataID;
	
		-- Begin Return Select <- do not remove
    SELECT   [Version]
	FROM    [HRM].[BaseValueData]
    WHERE   [BaseValueDataID] = @BaseValueDataID; 
       -- End Return Select <- do not remove
