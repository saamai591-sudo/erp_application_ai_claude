CREATE PROC [FSS].[spTopicReportStructureFormulaPrameterDelete] 
    @TopicReportStructureFormulaPrameterID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FSS].[TopicReportStructureFormulaPrameter]
	where [TopicReportStructureFormulaPrameterID] = @TopicReportStructureFormulaPrameterID)
	begin	



		DELETE
		FROM   [FSS].[TopicReportStructureFormulaPrameter]
		WHERE  [TopicReportStructureFormulaPrameterID] = @TopicReportStructureFormulaPrameterID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'TopicReportStructureFormulaPrameter', -- First argument.
		@TopicReportStructureFormulaPrameterID); -- Second argument.)
	end

