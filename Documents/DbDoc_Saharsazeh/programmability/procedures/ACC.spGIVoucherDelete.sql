
CREATE   PROC [ACC].[spGIVoucherDelete] 
    @GlVoucherID BIGINT,@Version INT

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	if @Version=(Select [Version] from [ACC].[GIVoucher]
	             WHERE GlVoucherID = @GlVoucherID)
	begin
		DECLARE @FinancialPeriodID INT,@Date DATETIME
		SELECT @FinancialPeriodID = g.FinancialPeriodID , @Date = [Date]
		  FROM ACC.GIVoucher g WHERE g.GlVoucherID = @GlVoucherID
		
		
		DELETE FROM   [ACC].[GIVoucher]
		WHERE [Date] >= @Date AND FinancialPeriodID = @FinancialPeriodID

		DELETE
		FROM   [ACC].[GIVoucher]
		WHERE GlVoucherID = @GlVoucherID 
		
		--SELECT * FROM acc.Voucher v WHERE v.FinancialPeriodID = @FinancialPeriodID
		--AND v.DocumentTypeID IN (2,3)--افتتاحيه، اختتاميه
	end
	else
	begin
	
	declare @n varchar = cast(@GlVoucherID as varchar(100))
	RAISERROR (N'Delete_%s_%s.', -- Message text.
           16, -- Severity,
           10, -- State,
           N'GIVoucher', -- First argument.
           @n); -- Second argument.

	end
