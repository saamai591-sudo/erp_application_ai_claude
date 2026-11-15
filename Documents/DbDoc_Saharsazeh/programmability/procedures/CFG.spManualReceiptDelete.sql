CREATE PROC [CFG].[spManualReceiptDelete] 
    @ManualReceiptID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [CFG].[ManualReceipt]
	where [ManualReceiptID] = @ManualReceiptID)
	begin	



		DELETE
		FROM   [CFG].[ManualReceipt]
		WHERE  [ManualReceiptID] = @ManualReceiptID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ManualReceipt', -- First argument.
		@ManualReceiptID); -- Second argument.)
	end

