

CREATE PROC [FSS].[spReportUpdate]
    @ReportID INT ,
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
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@Orientation TINYINT
AS
    SET NOCOUNT ON; 

    DECLARE @Message NVARCHAR(MAX);
    SELECT  @Message ='NumberIsDuplicate'
   

	-- check number duplicate
    IF @ParentReportID IS NOT NULL
        BEGIN
            IF EXISTS ( SELECT  1
                        FROM    FSS.Report
                        WHERE   ParentReportID = @ParentReportID
                                AND @ReportID <> ReportID
                                AND ReportType = @ReportType
                                AND Number = @Number )
                BEGIN			
                    RAISERROR(@Message,16,12);
                    RETURN;
                END;
        END;
    ELSE
        BEGIN
            IF EXISTS ( SELECT  1
                        FROM    FSS.Report
                        WHERE   Number = @Number
                                AND @ReportID <> ReportID
                                AND ReportType = @ReportType )
                BEGIN
                    RAISERROR(@Message,16,12);
                    RETURN;
                END;
        END;


    IF @Version = ( SELECT  [Version]
                    FROM    [FSS].[Report]
                    WHERE   [ReportID] = @ReportID
                  )
        BEGIN
	
	
		

            SET @Version = @Version + 1; 

            UPDATE  [FSS].[Report]
            SET     [FinancialStatementID] = @FinancialStatementID ,
                    [DataType] = @DataType ,
                    [ReportType] = @ReportType ,
                    [ParentReportID] = @ParentReportID ,
                    [Number] = @Number ,
                    [Title] = @Title ,
                    [Title2] = @Title2 ,
                    [PreReportText] = @PreReportText ,
                    [PreReportText2] = @PreReportText2 ,
                    [PostReportText] = @PostReportText ,
                    [PostReportText2] = @PostReportText2 ,
                    [Version] = @Version ,
                    [Creator] = @Creator ,
                    [CreationDate] = @CreationDate ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate,
					[Orientation] = @Orientation
            WHERE   [ReportID] = @ReportID;
	
		-- Begin Return Select <- do not remove
            SELECT  [Version]
             FROM    [FSS].[Report]
            WHERE   [ReportID] = @ReportID;	
		-- End Return Select <- do not remove

        END;
