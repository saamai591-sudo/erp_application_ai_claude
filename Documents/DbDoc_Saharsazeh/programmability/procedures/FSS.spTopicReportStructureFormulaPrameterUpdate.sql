CREATE PROC [FSS].[spTopicReportStructureFormulaPrameterUpdate] 
    @TopicReportStructureFormulaPrameterID int,
    @TopicReportStructureID int,
    @RelatedTopicReportStructureID int,
    @ItemValueTypeID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [FSS].[TopicReportStructureFormulaPrameter]
	where [TopicReportStructureFormulaPrameterID] = @TopicReportStructureFormulaPrameterID)
	begin	

		set @Version = @Version +1 

		UPDATE [FSS].[TopicReportStructureFormulaPrameter]
		SET    [TopicReportStructureID] = @TopicReportStructureID, [RelatedTopicReportStructureID] = @RelatedTopicReportStructureID, [ItemValueTypeID] = @ItemValueTypeID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [TopicReportStructureFormulaPrameterID] = @TopicReportStructureFormulaPrameterID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
        FROM   [FSS].[TopicReportStructureFormulaPrameter]
		WHERE  [TopicReportStructureFormulaPrameterID] = @TopicReportStructureFormulaPrameterID	
		-- End Return Select <- do not remove

	end
