
---------------------------------------------------------
CREATE   PROC [FSS].[spTopicInsert]
    @ParentReportID INT ,
    @Number INT ,
    @Title NVARCHAR(1024) ,
    @Title2 NVARCHAR(1024) ,
    @DataType TINYINT ,
    @ReferReportID INT ,
    @ComparativeTopicID INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@Level TINYINT
AS
    SET NOCOUNT ON; 

    IF @Number IS NULL
        OR @Number = 0
        BEGIN
            DECLARE @maxNumber INT;
            SELECT  @maxNumber = ISNULL(MAX(Number), 0)
            FROM    FSS.Topic
            WHERE   ParentReportID = @ParentReportID;
		
            IF @maxNumber IS NULL
                SET @Number = 1;
            ELSE
                SET @Number = @maxNumber + 1;

        END;
	
    INSERT  INTO [FSS].[Topic]
            ( [ParentReportID] ,
              [Number] ,
              [Title] ,
              [Title2] ,
              [DataType] ,
              [ReferReportID] ,
              [ComparativeTopicID] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate],
			  [Level]
            )
            SELECT  @ParentReportID ,
                    @Number ,
                    @Title ,
                    @Title2 ,
                    @DataType ,
                    @ReferReportID ,
                    @ComparativeTopicID ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate,
					@Level;
	
	-- Begin Return Select <- do not remove
    SELECT  [TopicID] ,
            [Version]
    FROM    [FSS].[Topic]
    WHERE   [TopicID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
