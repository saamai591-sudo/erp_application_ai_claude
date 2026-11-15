CREATE PROC [FSS].[spTopicReportStructureDelete] 
    @TopicReportStructureID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FSS].[TopicReportStructure]
	where [TopicReportStructureID] = @TopicReportStructureID)
	begin	



		DELETE
		FROM   [FSS].[TopicReportStructure]
		WHERE  [TopicReportStructureID] = @TopicReportStructureID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'TopicReportStructure', -- First argument.
		@TopicReportStructureID); -- Second argument.)
	end

