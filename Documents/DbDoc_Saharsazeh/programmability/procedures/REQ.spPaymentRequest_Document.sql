
-----------------------------------------
CREATE   PROC Req.spPaymentRequest_Document
(
	@FromDate DATE,
	@ToDate DATE,
	@SelectedBranchs NVARCHAR(MAX) = NULL,
	@SelectedOrganizationUnits NVARCHAR(MAX) = NULL
)

as

DECLARE @TableName       NVARCHAR(MAX),
		@SourceTable     NVARCHAR(MAX),
		@Query           NVARCHAR(MAX),
		@DateType        TINYINT,
		@DateFormat      VARCHAR(10),
		@Culture         VARCHAR(10) ,
		@CultureNo       TINYINT = 0,
		@UserID			INT
		
  SET @Culture = CFG.GetuserCulture();

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
	  
 declare @Submited nvarchar(25),
		@Confirmed nvarchar(25),
		@Rejected nvarchar(25),
		@Ended nvarchar(25);

SELECT @Submited = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'RequestStates'
	   AND L.Item = 'Submitted'
	   AND LV.Culture = @Culture;

SELECT @Confirmed = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'RequestStates'
	   AND L.Item = 'Confirmed'
	   AND LV.Culture = @Culture;

SELECT @Rejected = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'RequestStates'
	   AND L.Item = 'Rejected'
	   AND LV.Culture = @Culture;

SELECT @Ended = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'RequestStates'
	   AND L.Item = 'Ended'
	   AND LV.Culture = @Culture;       	
		
		
set @TableName = cfg.getTempTableName(1)
set @SourceTable = cfg.getTempTableName(1)		

EXEC req.spPaymentRequestReviewDataSource
	@SelectedBranchs = @SelectedBranchs,
	@SelectedOrganizationUnits = @SelectedOrganizationUnits,
	@TableName = @TableName,
	@FromDate = @FromDate,
	@ToDate = @ToDate
	
set @Query = N'
SELECT vprf.PaymentRequestItemID,
	   SUM(vprf.PaymentRequestAmount)     PaymentRequestAmount,
	   SUM(vprf.PaymentOrderAmount)       PaymentOrderAmount,
	   SUM(vprf.PaymentReceiptAmount)     PaymentReceiptAmount
INTO   '+@SourceTable + N'
FROM   '+@TableName+N'       AS vprf
GROUP BY       vprf.PaymentRequestItemID'

EXEC (@Query)

set @Query = N'
SELECT a.PaymentRequestItemID,
		b.PaymentRequestID,
	   d.Code PartyDlCode,
		case when @CultureNo = 1 then d.Title else d.Title2 end PartyDlTitle,
		case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,
		cfg.GetClrSaturnDate(pr.Date,@DateFormat,0,@DateType) Date,
		pr.Number,
		case pr.status when 1 then	@Submited
			  when 2 then			@Confirmed
			  when 3 then			@Rejected
			  when 4 then			@Ended
	end StatusString,
		ou.Code OrganizationCode,
		case when @CultureNo = 1 then ou.Title else ou.Title2 end OrganizationUnitTitle,
		br.Code BranchCode,
		case when @CultureNo = 1 then br.Title else br.Title2 end BranchTitle,		       
	   a.PaymentRequestAmount,
	   a.PaymentOrderAmount,
	   a.PaymentReceiptAmount,
	   a.PaymentRequestAmount -a.PaymentOrderAmount NonPaymentOrder,
	   a.PaymentRequestAmount -a.PaymentReceiptAmount NonPaymentReceipt,
	   case when @CultureNo = 1 then pr.Description else pr.Description2 end Description
FROM   '+@SourceTable +N' a
	   JOIN req.PaymentRequestItem AS b on a.PaymentRequestItemID = b.PaymentRequestItemID
	   join req.PaymentRequest pr on b.PaymentRequestID = pr.PaymentRequestID
	   join cfg.Party p on b.PartyID = p.PartyID
	   join acc.Dl d on p.DlID = d.DlID
	   join cfg.OrganizationUnit ou on pr.OrganizationUnitID = ou.OrganizationUnitID
	   join cfg.Branch br on pr.BranchID = br.BranchID 
	   Join cfg.Currency c on b.CurrencyID = c.CurrencyID '
	   
		EXECUTE sp_executesql @query,
	  N'@CultureNo		TINYINT,
		@DateFormat		NVARCHAR(10),
		@DateType		TINYINT,
		@Submited       NVarchar(MAX),
		@Confirmed		NVarchar(MAX),
		@Rejected		NVarchar(MAX),
		@Ended			NVarchar(MAX)',
		@CultureNo =	@CultureNo,
		@DateFormat =	@DateFormat,
		@DateType =		@DateType,
		@Submited =		@Submited,   
		@Confirmed=		@Confirmed	,
		@Rejected =		@Rejected	,
		@Ended	= @Ended;
