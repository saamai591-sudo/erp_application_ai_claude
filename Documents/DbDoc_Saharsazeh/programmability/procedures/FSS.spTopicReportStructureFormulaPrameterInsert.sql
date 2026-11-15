
---------------------------------------------------------
CREATE   PROC [FSS].[spTopicReportStructureFormulaPrameterInsert] 
    @TopicReportStructureID int,
    @RelatedTopicReportStructureID int,
    @ItemValueTypeID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [FSS].[TopicReportStructureFormulaPrameter] ([TopicReportStructureID], [RelatedTopicReportStructureID], [ItemValueTypeID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @TopicReportStructureID, @RelatedTopicReportStructureID, @ItemValueTypeID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [TopicReportStructureFormulaPrameterID], [Version]
	FROM   [FSS].[TopicReportStructureFormulaPrameter]
	WHERE  [TopicReportStructureFormulaPrameterID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
