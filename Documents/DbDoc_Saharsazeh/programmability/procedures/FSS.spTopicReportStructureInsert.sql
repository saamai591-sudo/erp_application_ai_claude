
---------------------------------------------------------
CREATE   PROC [FSS].[spTopicReportStructureInsert]
    @TopicID INT ,
    @ReportColumnID INT ,
    @CalculationType TINYINT ,
    @DataType TINYINT ,
    @FormulaExpression VARCHAR(MAX) ,
    @FormulaSqlExpression VARCHAR(MAX) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @DocumentTypeIds NVARCHAR(255)
AS
    SET NOCOUNT ON; 
    DECLARE @ID INT;
    SET @FormulaSqlExpression = PAY.CreateSqlExpression(@FormulaExpression);

    INSERT  INTO [FSS].[TopicReportStructure]
            ( [TopicID] ,
              [ReportColumnID] ,
              [CalculationType] ,
              [DataType] ,
              [FormulaExpression] ,
              [FormulaSqlExpression] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate],
			  DocumentTypeIds
            )
            SELECT  @TopicID ,
                    @ReportColumnID ,
                    @CalculationType ,
                    @DataType ,
                    @FormulaExpression ,
                    @FormulaSqlExpression ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate,
					@DocumentTypeIds;

    SET @ID = SCOPE_IDENTITY();
	
    EXEC FSS.[UpdateTopicReportStructureFormulaParameters] @ID,
        @FormulaExpression;

	-- Begin Return Select <- do not remove
    SELECT  [TopicReportStructureID] ,
            [Version] 
    FROM    [FSS].[TopicReportStructure]
    WHERE   [TopicReportStructureID] = @ID;
	-- End Return Select <- do not remove
