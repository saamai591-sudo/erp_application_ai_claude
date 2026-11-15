
CREATE   PROC [ACC].[spVoucherAnalyzeDelete] 
    @VoucherAnalyzeID int,
    @Version INT
AS 
	
		DELETE
			FROM   [ACC].[VoucherAnalyze]
		WHERE  [VoucherAnalyzeID] = @VoucherAnalyzeID 

