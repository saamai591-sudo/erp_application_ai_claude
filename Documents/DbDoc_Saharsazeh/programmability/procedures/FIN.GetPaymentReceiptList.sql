
-----------------------------------
CREATE   PROCEDURE [FIN].GetPaymentReceiptList
(
    @FinancialPeriodID INT,
    @IsPaymentWithOrder BIT = 0,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS

DECLARE @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @Establish NVARCHAR(150),
        @Revoke NVARCHAR(150),
        @Voucher NVARCHAR(150),
        @PreVoucher NVARCHAR(150),
		@WithoutVoucher	NVARCHAR(150),
        @ViewRelatedToUser INT,
        @ViewRelatedToOthers NVARCHAR(MAX),
        @Register NVARCHAR(150),
        @Culture VARCHAR(5),
        @CultureNo TINYINT,
        @UnauthorizedUsers NVARCHAR(MAX);

SET @UserID = cfg.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT @DateType = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END;

SELECT @DateFormat = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

SELECT * into #vwEnums
	FROM cfg.VwEnums AS ve
	WHERE ve.Enum = 'StatusOfReceipt'

SELECT @ViewRelatedToUser = UserID
FROM CFG.vwOperationLevelAccess
WHERE EntityName = 'PaymentReceipt'
      AND AccessKey = 'ViewRelatedToUser'
      AND UserID = @UserID;

SELECT @ViewRelatedToOthers = UserID,
       @UnauthorizedUsers = Users
FROM CFG.vwOperationLevelAccess
WHERE EntityName = 'PaymentReceipt'
      AND AccessKey = 'ViewRelatedToOthers'
      AND UserID = @UserID;

SELECT @Voucher = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'DocumentStatus'
	   AND L.Item = 'Voucher'
	   AND LV.Culture = @Culture;

SELECT @PreVoucher = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'DocumentStatus'
	   AND L.Item = 'PreVoucher'
	   AND LV.Culture = @Culture;

SELECT @WithoutVoucher = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'DocumentStatus'
	   AND L.Item = 'WithoutVoucher'
	   AND LV.Culture = @Culture;

DECLARE @BaseCurrencyPrecision INT;
SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

SELECT i.PaymentReceiptID,
       SUM(i.PaymentAmountInBaseCurrency) PaymentAmountInBaseCurrency
INTO #items
FROM
(
    SELECT a.PaymentReceiptID,
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(a.Amount * a.CurrencyRate / c.ExchangeUnit, @BaseCurrencyPrecision)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(a.Amount * c.ExchangeUnit / a.CurrencyRate, @BaseCurrencyPrecision)
           END AS PaymentAmountInBaseCurrency
    FROM
    (
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentBankDraft
        UNION ALL
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentCheqe
        UNION ALL
        SELECT PaymentReceiptID,
               c.CurrencyID,
               c.CurrencyRate,
               c.Amount
        FROM FIN.PaymentOtherCheqe o
            JOIN FIN.ReceivedCheqe c
                ON o.ReceivedCheqeID = c.ReceivedCheqeID
        UNION ALL
        SELECT PaymentReceiptID,
               CurrencyID,
               CurrencyRate,
               Amount
        FROM FIN.PaymentCash
    ) a
        JOIN CFG.Currency c
            ON a.CurrencyID = c.CurrencyID
) i
GROUP BY i.PaymentReceiptID;


IF @Sort IS NULL
   OR @Sort = ''
    SET @Sort = 'Number';

DECLARE @Query NVARCHAR(MAX),
        @PaymentWithOrderCondition NVARCHAR(MAX) = '';

IF(@IsPaymentWithOrder = 1)
    Set @PaymentWithOrderCondition = N' AND p.PaymentOrderID IS NOT NULL'
else
    Set @PaymentWithOrderCondition = N' AND p.PaymentOrderID IS NULL'

SET @Query
    = N'   
	select * 
	into #vwBranchAccess
	from cfg.vwBranchAccess

	select *
	into #vwVoucherPrevoucher
	from acc.vwVoucherPrevoucher
	where engname = ''PaymentReceipt''
	and FinancialPeriodID = @FinancialPeriodID

	   ; WITH Query_Result 			
				As (				
	           SELECT p.PaymentReceiptID,
	                  p.PaymentRequestID,
					  p.PaymentOrderID,
	                  p.FinancialPeriodID,
	                  p.BranchID,
	                  p.Number,
	                  p.[Date],
	                  p.PartyID,
	                  i.PaymentAmountInBaseCurrency,
	                  p.[Description],
	                  p.Description2,
	                  p.PreVoucherID,
	                  p.[Status],
	                  p.[Version],
	                  p.Creator,
	                  p.CreationDate,
					  p.LastEditor,
	                  p.LastEditionDate,
	                  b.Code BranchCode,
                      paymentOrder.Number PaymentOrderNumber,
					  case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then b.Title
	                       when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then b.Title2
	                  end as BranchName,
	                  d.Code PartyCode,	 
					  case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then d.Title
	                       when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then d.Title2
	                  end as PartyName,					 
	                  CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date_Date,
	                  CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) CreateDateString,
	                  CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) EditionDateString,
	                  u.[Name]            AS CreatorUserName,
	                  u2.[Name]           AS EditorName,
	                  v.VoucherID        AS VoucherID,
	                  v.ReferenceNumber   AS VoucherNumber,
					  v.Date VoucherDate,
	                  CFG.GetCLRSaturnDate(v.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
	                  pr.Number RequestNumber,
					  CAST(ve.Value AS NVARCHAR(150)) AS StatusString,
                      CASE
							WHEN v.VoucherID IS NOT NULL AND v.VoucherID <> 0 THEN @Voucher
							WHEN p.PreVoucherID IS NOT NULL AND p.PreVoucherID <> 0 THEN @PreVoucher
							ELSE @WithoutVoucher
					  END AS DocumentStatusString
	           FROM FIN.PaymentReceipt p
	           join #vwEnums ve on p.Status = ve.KeyValue and ve.Enum = ''StatusOfReceipt''
		           JOIN cfg.Branch b ON b.BranchID = p.BranchID
	               JOIN cfg.Party pa ON p.PartyID = pa.PartyID
			       LEFT JOIN acc.DL d ON d.DLID = pa.DlID
	               JOIN cfg.[User] u ON u.UserID = p.Creator
			       JOIN cfg.[User] u2 ON u2.UserID = p.LastEditor
			       join #items i on p.PaymentReceiptID = i.PaymentReceiptID
	               LEFT JOIN #vwVoucherPrevoucher v ON v.PrevoucherID = p.PreVoucherID
			       LEFT JOIN REQ.PaymentRequest pr ON p.PaymentRequestID = pr.PaymentRequestID
                   INNER JOIN #vwBranchAccess AS vba ON vba.BranchID=p.BranchID
                   LEFT JOIN REQ.PaymentOrder paymentOrder ON p.PaymentOrderID = paymentOrder.PaymentOrderID 
	           WHERE p.FinancialPeriodID = @FinancialPeriodID
				   AND (@UserID = -1
						OR (@ViewRelatedToUser IS NOT NULL AND p.Creator = @UserID)
						OR (@ViewRelatedToOthers IS NOT NULL AND p.Creator NOT IN ( SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
					)
                    '+ @PaymentWithOrderCondition + N'
				)';

DECLARE @selectQuery NVARCHAR(MAX);

IF @Filter IS NULL
   OR @Filter = ''
    SET @Filter = '';
ELSE
    SET @Filter = 'Where (' + @Filter + ')';

DECLARE @tableName VARCHAR(100);
SET @tableName = cfg.getTempTableName(1);

SET @Query = Cfg.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);

EXECUTE sp_executesql @Query,
                      N'@dateFormat varchar(10),
		   @dateType int,
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers NVARCHAR(MAX),
		   @FinancialPeriodID int,
           @UserID int,
		   @ViewRelatedToUser int,
		   @Establish NVARCHAR(150),
		   @Revoke NVARCHAR(150),
		   @Voucher NVARCHAR(150),
		   @PreVoucher NVARCHAR(150),
		   @WithoutVoucher NVARCHAR(150),
		   @Register NVARCHAR(150),
		   @Culture VARCHAR(25)',
                      @Establish = @Establish,
                      @Revoke = @Revoke,
                      @Voucher = @Voucher,
                      @PreVoucher = @PreVoucher,
					  @WithoutVoucher = @WithoutVoucher,
                      @Register = @Register,
                      @Culture = @Culture,
                      @DateType = @DateType,
                      @FinancialPeriodID = @FinancialPeriodID,
                      @DateFormat = @DateFormat,
                      @ViewRelatedToUser = @ViewRelatedToUser,
                      @ViewRelatedToOthers = @ViewRelatedToOthers,
                      @UnauthorizedUsers = @UnauthorizedUsers,
                      @UserID = @UserID;

DECLARE @Count INT;

EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

RETURN ISNULL(@Count, 0);
