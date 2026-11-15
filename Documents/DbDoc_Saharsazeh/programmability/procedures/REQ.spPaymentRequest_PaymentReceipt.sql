
-------------------------------------------- START #7371
CREATE   PROC [REQ].[spPaymentRequest_PaymentReceipt]
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
	
	SET @UserID = cfg.GetuserID()

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
		
	SET @TableName = cfg.getTempTableName(1)
	SET @SourceTable = cfg.getTempTableName(1)		

	EXEC req.spPaymentRequestReviewDataSource
		@SelectedBranchs = null,
		@SelectedOrganizationUnits = null,
		@TableName = @TableName,
		@FromDate = null,
		@ToDate = null,
		@SelectedType = 'PaymentReceipt',
		@SelectedDocument = @SelectedDocument	
	
	SET @Query = N'
	SELECT vprf.PaymentReceiptID,
		   SUM(vprf.PaymentReceiptAmount)       PaymentReceiptAmount
	INTO   '+@SourceTable + N'
	FROM   '+@TableName+N'       AS vprf
	GROUP BY       vprf.PaymentReceiptID'

	EXEC (@Query)

	SET @Query = N'

	SELECT a.PaymentReceiptID AS DocumentID,
			cfg.GetClrSaturnDate(po.Date,@DateFormat,0,@DateType) Date,
			po.Number,
			a.PaymentReceiptAmount Amount,
			po.PaymentOrderID
	FROM   '+@SourceTable +N' a
	join   fin.PaymentReceipt po on a.PaymentReceiptID = po.PaymentReceiptID
	   
		   '
	   
	EXECUTE sp_executesql @query,
	  N'@DateFormat		NVARCHAR(10),
		@DateType		TINYINT',
		@DateFormat =	@DateFormat,
		@DateType =		@DateType
