
---------------------------------------------------------
CREATE   PROC [FSS].[spReportInsert]
    @FinancialStatementID INT ,
    @DataType TINYINT ,
    @ReportType TINYINT ,
    @ParentReportID INT ,
    @Number INT ,
    @Title NVARCHAR(1024) ,
    @Title2 NVARCHAR(1024) ,
    @PreReportText NTEXT ,
    @PreReportText2 NTEXT ,
    @PostReportText NTEXT ,
    @PostReportText2 NTEXT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@Orientation TINYINT
AS
    SET NOCOUNT ON; 
    DECLARE @Message NVARCHAR(MAX);
    SELECT  @Message =  'NumberIsDuplicate'
   

	-- check number duplicate
    IF @ParentReportID IS NOT NULL
        BEGIN
            IF EXISTS ( SELECT  1
                        FROM    FSS.Report
                        WHERE   ParentReportID = @ParentReportID
								AND ReportType = @ReportType
                                AND Number = @Number )
                BEGIN			
                    RAISERROR(@Message,16,12);
					RETURN
                END;
        END;
    ELSE
        BEGIN
            IF EXISTS ( SELECT  1
                        FROM    FSS.Report
                        WHERE   Number = @Number AND 
								ReportType = @ReportType )
                BEGIN
                    RAISERROR(@Message,16,12);
					RETURN
                END;
        END;
	
    INSERT  INTO [FSS].[Report]
            ( [FinancialStatementID] ,
              [DataType] ,
              [ReportType] ,
              [ParentReportID] ,
              [Number] ,
              [Title] ,
              [Title2] ,
              [PreReportText] ,
              [PreReportText2] ,
              [PostReportText] ,
              [PostReportText2] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate],
			  Orientation
            )
            SELECT  @FinancialStatementID ,
                    @DataType ,
                    @ReportType ,
                    @ParentReportID ,
                    @Number ,
                    @Title ,
                    @Title2 ,
                    @PreReportText ,
                    @PreReportText2 ,
                    @PostReportText ,
                    @PostReportText2 ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate,
					@Orientation;
	
	-- Begin Return Select <- do not remove
    SELECT  [ReportID] ,
            [Version] 
    FROM    [FSS].[Report]
    WHERE   [ReportID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
