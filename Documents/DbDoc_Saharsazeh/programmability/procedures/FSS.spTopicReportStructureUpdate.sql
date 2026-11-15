
CREATE PROC [FSS].[spTopicReportStructureUpdate]
    @TopicReportStructureID INT ,
    @TopicID INT ,
    @ReportColumnID INT ,
    @CalculationType TINYINT ,
    @DataType TINYINT ,
    @FormulaExpression VARCHAR(MAX) ,
    @FormulaSqlExpression VARCHAR(MAX) ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @DocumentTypeIds NVARCHAR(255)
AS
    SET NOCOUNT ON; 


    IF @Version = ( SELECT  [Version]
                    FROM    [FSS].[TopicReportStructure]
                    WHERE   [TopicReportStructureID] = @TopicReportStructureID
                  )
        BEGIN	

            SET @Version = @Version + 1; 

            SET @FormulaSqlExpression = PAY.CreateSqlExpression(@FormulaExpression);

            UPDATE  [FSS].[TopicReportStructure]
            SET     [TopicID] = @TopicID ,
                    [ReportColumnID] = @ReportColumnID ,
                    [CalculationType] = @CalculationType ,
                    [DataType] = @DataType ,
                    [FormulaExpression] = @FormulaExpression ,
                    [FormulaSqlExpression] = @FormulaSqlExpression ,
                    [Version] = @Version ,
                    [Creator] = @Creator ,
                    [CreationDate] = @CreationDate ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate,
					DocumentTypeIds =@DocumentTypeIds
            WHERE   [TopicReportStructureID] = @TopicReportStructureID;
	

            DELETE  FSS.TopicReportStructureFormulaPrameter
            WHERE   TopicReportStructureID = @TopicReportStructureID;


            EXEC FSS.[UpdateTopicReportStructureFormulaParameters] @TopicReportStructureID,
                @FormulaExpression;
		-- Begin Return Select <- do not remove
            SELECT   [Version]
             FROM    [FSS].[TopicReportStructure]
            WHERE   [TopicReportStructureID] = @TopicReportStructureID;	
		-- End Return Select <- do not remove

        END;
