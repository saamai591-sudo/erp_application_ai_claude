
----------------------------------------------------------------------------
CREATE   PROC Req.spPaymentRequest_Branch
(
	@FromDate DATE,
	@ToDate DATE,
	@SelectedOrganizationUnits NVARCHAR(MAX) = NULL
)

as

DECLARE @TableName       NVARCHAR(MAX),
		@SourceTable     NVARCHAR(MAX),
		@Query           NVARCHAR(MAX),
		@Culture         VARCHAR(10),
		@CultureNo       TINYINT,
		@UserID          INT
		
set @Culture = CFG.GetuserCulture();      

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;
	
SET @UserID = cfg.GetuserID()
		
SET @TableName = cfg.getTempTableName(1)
SET @SourceTable = cfg.getTempTableName(1)		


EXEC req.spPaymentRequestReviewDataSource
	 @SelectedBranchs = null,
	 @SelectedOrganizationUnits = @SelectedOrganizationUnits,
	 @TableName = @TableName,
	 @FromDate = @FromDate,
	 @ToDate = @ToDate
		
SET @Query = 
	N'
SELECT vprf.BranchID,CurrencyID,
	   SUM(vprf.PaymentRequestAmount)     PaymentRequestAmount,
	   SUM(vprf.PaymentOrderAmount)       PaymentOrderAmount,
	   SUM(vprf.PaymentReceiptAmount)     PaymentReceiptAmount
INTO   ' + @SourceTable + N'
FROM   ' + @TableName + N'       AS vprf
GROUP BY       vprf.BranchID,CurrencyID'

EXEC (@Query)

SET @Query = 
		 N'SELECT b.BranchID,
	   b.Code BranchCode,
	   case when @Cultureno = 1 then b.Title else b.Title2 end BranchTitle,
	   case when @Cultureno = 1 then c.Title else c.Title2 end CurrencyTitle,
	   a.PaymentRequestAmount,
	   a.PaymentOrderAmount,
	   a.PaymentReceiptAmount,
	   a.PaymentRequestAmount -a.PaymentOrderAmount NonPaymentOrder,
	   a.PaymentRequestAmount -a.PaymentReceiptAmount NonPaymentReceipt
FROM   ' + @SourceTable + N' a
	   JOIN cfg.Branch AS b on a.BranchID = b.BranchID
	   join cfg.Currency c on a.CurrencyID = c.CurrencyID'
	
		 EXECUTE sp_executesql @query,
	  N'@CultureNo		TINYINT',
		@CultureNo =	@CultureNo
