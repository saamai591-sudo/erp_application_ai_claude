		
----------------------------------------------------------------------------------------------
CREATE   PROC Req.spPaymentRequest_PaymentOrder
(
	@SelectedDocument INT
)

as

DECLARE @TableName       NVARCHAR(MAX),
		@SourceTable     NVARCHAR(MAX),
		@Query           NVARCHAR(MAX),
		@DateType        TINYINT,
		@DateFormat      VARCHAR(10),
		@Culture         VARCHAR(10),
		@CultureNo       TINYINT,
		@UserID			INT
		

	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	
	set @UserID = cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID;

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END;

	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';	
		
		
		
		
set @TableName = cfg.getTempTableName(1)
set @SourceTable = cfg.getTempTableName(1)		


EXEC req.spPaymentRequestReviewDataSource
	@SelectedBranchs = null,
	@SelectedOrganizationUnits = null,
	@TableName = @TableName,
	@FromDate = null,
	@ToDate = null,
	@SelectedType = 'PaymentOrder',
	@SelectedDocument = @SelectedDocument	
	

set @Query = N'
SELECT vprf.PaymentOrderID,
	   SUM(vprf.PaymentOrderAmount)       PaymentOrderAmount
INTO   '+@SourceTable + N'
FROM   '+@TableName+N'       AS vprf
GROUP BY       vprf.PaymentOrderID'

EXEC (@Query)

set @Query = N'

SELECT a.PaymentOrderID AS DocumentID,
		cfg.GetClrSaturnDate(po.Date,@DateFormat,0,@DateType) Date,
		po.Number,
		a.PaymentOrderAmount Amount
FROM   '+@SourceTable +N' a
		join    Req.PaymentOrder po on a.PaymentOrderID = po.PaymentOrderID
	   
	   '
	   
		EXECUTE sp_executesql @query,
	  N'@DateFormat		NVARCHAR(10),
		@DateType		TINYINT',
		@DateFormat =	@DateFormat,
		@DateType =		@DateType
