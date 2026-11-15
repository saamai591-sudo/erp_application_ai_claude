
CREATE PROC [SLE].[spSaleContractDelete] 
    @SaleContractID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [SLE].[SaleContract]
	where [SaleContractID] = @SaleContractID)
	begin	



		DELETE
		FROM   [SLE].[SaleContract]
		WHERE  [SaleContractID] = @SaleContractID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'SaleContract', -- First argument.
		@SaleContractID); -- Second argument.)
	end
