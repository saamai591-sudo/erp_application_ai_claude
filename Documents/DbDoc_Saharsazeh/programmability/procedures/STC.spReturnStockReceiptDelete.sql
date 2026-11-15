CREATE PROC [STC].[spReturnStockReceiptDelete] 
    @ReturnStockReceiptID int,@Version int
	--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	DECLARE @PreVersion INT,
			@PreVoucher INT,
			@stockId INT,
			@message NVARCHAR(MAX)
	
	Select @PreVersion = [Version], @stockId = StockID,
	@PreVoucher = PreVoucherID from [STC].[ReturnStockReceipt]
	where [ReturnStockReceiptID] = @ReturnStockReceiptID
	
	IF @PreVoucher IS NOT NULL
		BEGIN
		     RAISERROR('UnableToDeletePrevoucher',16,12);
				RETURN;
		END
	
	if @Version=@PreVersion
	begin	

		DECLARE @ItemID int,@ItemVersion int
		
		select ReturnStockReceiptItemID , Version
		from stc.ReturnStockReceiptItem
		where ReturnStockReceiptID = @ReturnStockReceiptID
			
		DELETE CFG.EntityCustomeFieldData
		where EntityCustomeFieldID in (
										select EntityCustomeFieldID 
										from CFG.EntityCustomeField 
										where EntityName = 'ReturnQuantityReceipt'
									  )
				and				
				EntityID = @ReturnStockReceiptID

		DELETE
		FROM   [STC].[ReturnStockReceipt]
		WHERE  [ReturnStockReceiptID] = @ReturnStockReceiptID
		
	end
	else
	begin
		RAISERROR (N'Delete_%s_%d.', -- Message text.
			16, -- Severity,
			10, -- State,
			N'ReturnStockReceipt', -- First argument.
			@ReturnStockReceiptID); -- Second argument.)
	end
