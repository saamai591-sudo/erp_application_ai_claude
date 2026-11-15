CREATE PROC [CFG].[spInstallmentPaymentDelete] 
    @InstallmentPaymentID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [CFG].[InstallmentPayment]
	where [InstallmentPaymentID] = @InstallmentPaymentID)
	begin	



		DELETE
		FROM   [CFG].[InstallmentPayment]
		WHERE  [InstallmentPaymentID] = @InstallmentPaymentID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'InstallmentPayment', -- First argument.
		@InstallmentPaymentID); -- Second argument.)
	end

