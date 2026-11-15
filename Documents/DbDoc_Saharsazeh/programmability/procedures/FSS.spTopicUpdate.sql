

CREATE PROC [FSS].[spTopicUpdate]
    @TopicID INT ,
    @ParentReportID INT ,
    @Number INT ,
    @Title NVARCHAR(1024) ,
    @Title2 NVARCHAR(1024) ,
    @DataType TINYINT ,
    @ReferReportID INT ,
    @ComparativeTopicID INT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Level TINYINT
AS
    SET NOCOUNT ON; 


    IF @Version = ( SELECT  [Version]
                    FROM    [FSS].[Topic]
                    WHERE   [TopicID] = @TopicID
                  )
        BEGIN	

            SET @Version = @Version + 1; 

            IF @Number IS NULL
                OR @Number = 0
                BEGIN
                    DECLARE @maxNumber INT;
                    SELECT  @maxNumber = ISNULL(MAX(Number), 0)
                    FROM    FSS.Topic
                    WHERE   ParentReportID = @ParentReportID
                            AND TopicID = @TopicID;
		
                    IF @maxNumber IS NULL
                        SET @Number = 1;
                    ELSE
                        SET @Number = @maxNumber + 1;

                END;


            UPDATE  [FSS].[Topic]
            SET     [ParentReportID] = @ParentReportID ,
                    [Number] = @Number ,
                    [Title] = @Title ,
                    [Title2] = @Title2 ,
                    [DataType] = @DataType ,
                    [ReferReportID] = @ReferReportID ,
                    [ComparativeTopicID] = @ComparativeTopicID ,
                    [Version] = @Version ,
                    [Creator] = @Creator ,
                    [CreationDate] = @CreationDate ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate,
                    [Level] = @Level
            WHERE   [TopicID] = @TopicID;
	
		-- Begin Return Select <- do not remove
            SELECT   [Version]
            FROM    [FSS].[Topic]
            WHERE   [TopicID] = @TopicID;	
		-- End Return Select <- do not remove

        END;
