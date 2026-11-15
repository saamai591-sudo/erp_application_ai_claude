CREATE PROC [FOS].[spProformaInvoiceItemDelete] 
    @ProformaInvoiceItemID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FOS].[ProformaInvoiceItem]
	where [ProformaInvoiceItemID] = @ProformaInvoiceItemID)
	begin	



		DELETE
		FROM   [FOS].[ProformaInvoiceItem]
		WHERE  [ProformaInvoiceItemID] = @ProformaInvoiceItemID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ProformaInvoiceItem', -- First argument.
		@ProformaInvoiceItemID); -- Second argument.)
	end

