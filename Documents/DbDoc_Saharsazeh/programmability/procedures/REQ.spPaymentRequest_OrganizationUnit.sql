
----------------------------------------------------------------------------------------------
CREATE   PROC Req.spPaymentRequest_OrganizationUnit
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedBranchs NVARCHAR(MAX) = NULL
)

as

DECLARE @TableName       NVARCHAR(MAX),
        @SourceTable     NVARCHAR(MAX),
        @Query           NVARCHAR(MAX),
        @Culture         VARCHAR(10),
        @CultureNo       TINYINT,
        @UserID          INT
        
  SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;
    
SET @UserID = cfg.GetuserID()
		
SET @TableName = cfg.getTempTableName(1)
SET @SourceTable = cfg.getTempTableName(1)		


EXEC req.spPaymentRequestReviewDataSource
     @SelectedBranchs = @SelectedBranchs,
     @SelectedOrganizationUnits = null,
     @TableName = @TableName,
     @FromDate = @FromDate,
     @ToDate = @ToDate
	
	
	
	
	
SET @Query = 
    N'
SELECT vprf.OrganizationUnitID,CurrencyID,
       SUM(vprf.PaymentRequestAmount)     PaymentRequestAmount,
       SUM(vprf.PaymentOrderAmount)       PaymentOrderAmount,
       SUM(vprf.PaymentReceiptAmount)     PaymentReceiptAmount
INTO   ' + @SourceTable + N'
FROM   ' + @TableName + N'       AS vprf
GROUP BY       vprf.OrganizationUnitID,CurrencyID'

EXEC (@Query)


set @Query = 
         N'

SELECT b.OrganizationUnitID,
       b.Code OrganizationUnitCode,
        case when @Cultureno = 1 then b.Title else b.Title2 end OrganizationUnitTitle,
       case when @Cultureno = 1 then c.Title else c.Title2 end CurrencyTitle,
       a.PaymentRequestAmount,
       a.PaymentOrderAmount,
       a.PaymentReceiptAmount,
       a.PaymentRequestAmount -a.PaymentOrderAmount NonPaymentOrder,
       a.PaymentRequestAmount -a.PaymentReceiptAmount NonPaymentReceipt
FROM   ' + @SourceTable + N' a
       JOIN cfg.OrganizationUnit AS b on a.OrganizationUnitID = b.OrganizationUnitID	   
	   join cfg.Currency c on a.CurrencyID = c.CurrencyID'

         EXECUTE sp_executesql @query,
      N'@CultureNo		TINYINT',
		@CultureNo =	@CultureNo     
