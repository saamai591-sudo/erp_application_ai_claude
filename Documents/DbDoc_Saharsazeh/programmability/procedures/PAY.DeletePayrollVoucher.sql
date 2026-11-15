CREATE   PROCEDURE [PAY].[DeletePayrollVoucher]
(
    @CalendarMonthId      INT,
    @calcTypeId           INT,
    @selectedPersonel     NVARCHAR(MAX),
    @Force                BIT = 0
)

--WITH ENCRYPTION
AS
	DECLARE @SettlementCalcType INT,
			@CalculationPersonelID INT
	
	
	SELECT CAST( VALUE AS int) AS PersonelID
	INTO   #SelectedPersonel
	FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	
	
	
	DECLARE @Message NVARCHAR(MAX)      
	
	SELECT cp.VoucherID
	INTO   #T
	FROM   pay.CalculationPersonel cp
	       INNER JOIN #SelectedPersonel rfcst
	            ON  rfcst.PersonelID = cp.PersonelID
	WHERE  cp.CalendarMonthID =@CalendarMonthId
	AND cp.CalculationTypeID=@calcTypeId 
	GROUP BY    cp.VoucherID  
	
	 
	IF EXISTS (
	       SELECT 1
	       FROM   Acc.Voucher AS v
	              INNER JOIN #T
	                   ON  #T.VoucherID = v.VoucherID
	             INNER JOIN acc.VoucherItem AS vi
	             ON vi.VoucherID = v.VoucherID
	             INNER JOIN acc.DCNote AS d
	             ON d.VoucherItemID = vi.VoucherItemID
	   )
	BEGIN
	    RAISERROR('E_برای برخی از اقلام این سند اعلامیه صادر ده است .امکان حذف سند نمي باشد', 16, 12)
	    RETURN
	END
	    
	
	IF EXISTS (
	       SELECT 1
	       FROM   Acc.Voucher AS v
	              INNER JOIN #T
	                   ON  #T.VoucherID = v.VoucherID
	       WHERE   v.VoucherStatusID IN (3, 4)
	   )
	BEGIN
	    RAISERROR('E_امکان حذف سند نمي باشد', 16, 12)
	    RETURN
	END
	
	IF @Force = 0
	BEGIN
	    IF EXISTS (
	           SELECT 1
	           FROM   pay.CalculationPersonel cp
	                  INNER JOIN #T
	            ON  #T.VoucherID = cp.VoucherID
	            LEFT JOIN #SelectedPersonel
	            ON #SelectedPersonel.PersonelID=cp.PersonelID
	           WHERE  #SelectedPersonel.PersonelID is null --PersonelID NOT IN (SELECT VALUE
	                                    -- FROM   #SelectedPersonel)
	       )
	    BEGIN
	        SELECT @Message = 'E_Exists' 
	        RAISERROR(@Message, 16, 10)
	        RETURN
	    END
	END     
		 
	DELETE acc.Voucher
	FROM acc.Voucher
	INNER JOIN #T
	ON acc.Voucher.VoucherID=#T.VoucherID
