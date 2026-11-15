
CREATE PROC [FSS].[spTopicDelete] 
    @TopicID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FSS].[Topic]
	where [TopicID] = @TopicID)
	begin	



		DELETE
		FROM   [FSS].[Topic]
		WHERE  [TopicID] = @TopicID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Topic', -- First argument.
		@TopicID); -- Second argument.)
	end

