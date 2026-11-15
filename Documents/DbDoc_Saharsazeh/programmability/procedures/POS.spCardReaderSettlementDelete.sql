
CREATE PROC [POS].[spCardReaderSettlementDelete] 
    @CardReaderSettlementID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [POS].[CardReaderSettlement]
	where [CardReaderSettlementID] = @CardReaderSettlementID)
	begin	



		DELETE
		FROM   [POS].[CardReaderSettlement]
		WHERE  [CardReaderSettlementID] = @CardReaderSettlementID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CardReaderSettlement', -- First argument.
		@CardReaderSettlementID); -- Second argument.)
	end

