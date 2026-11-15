CREATE PROC [STC].[spReturnedTemporaryStockReceiptDelete] 
    @ReturnedTemporaryStockReceiptID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [STC].[ReturnedTemporaryStockReceipt]
	where [ReturnedTemporaryStockReceiptID] = @ReturnedTemporaryStockReceiptID)
	begin	



		DELETE
		FROM   [STC].[ReturnedTemporaryStockReceipt]
		WHERE  [ReturnedTemporaryStockReceiptID] = @ReturnedTemporaryStockReceiptID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ReturnedTemporaryStockReceipt', -- First argument.
		@ReturnedTemporaryStockReceiptID); -- Second argument.)
	end
