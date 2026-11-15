---------------------------------------------------------------------------------
CREATE   PROCEDURE [FIN].[spGetBaseDocumentForPaymentReceipt]
(
	@Type TINYINT,
	@BranchID INT,
	@DlID BIGINT = NULL,
	@Date DATE,
	@CurrencyID INT = NULL,
	@InvoiceRequested BIT = 0
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@PurchaseInvoice NVARCHAR(100),
			@ReturnedSaleInvoice NVARCHAR(100),
			@Sale NVARCHAR(100),
			@ConfigValue VARCHAR(25),
			@Culture NVARCHAR(100),
			@CultureNo TINYINT,
			@Import NVARCHAR(100),
			@Internal NVARCHAR(100),
			@Proposal NVARCHAR(100),
			@PurchaseContract NVARCHAR(100),
			@Installment NVARCHAR(100),
			@InstallmentItem NVARCHAR(100),
			@ConfirmPurchaseInvoice NVARCHAR(50),
			@ConfirmPurchaseInvoiceItem NVARCHAR(50);

	SET @UserID = CFG.GetuserID();
	SET @Culture = cfg.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
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
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	SELECT @Installment = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'BaseDocuments'
		  AND le.Item = 'Installment'
		  AND lev.Culture = @Culture;

	SELECT @InstallmentItem = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'LoanTypes'
		  AND le.Item = 'Installment'
		  AND lev.Culture = @Culture;

	SELECT @Proposal = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'BaseDocuments'
		  AND le.Item = 'Proposal'
		  AND lev.Culture = @Culture;

	SELECT @PurchaseContract = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'BaseDocuments'
		  AND le.Item = 'PurchaseContract'
		  AND lev.Culture = @Culture;


	SELECT @PurchaseInvoice = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'DocumentNumTypes'
		  AND le.Item = 'PurchaseInvoice'
		  AND lev.Culture = @Culture;

	SELECT @ReturnedSaleInvoice = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'DocumentNumTypes'
		  AND le.Item = 'ReturnedSaleInvoice'
		  AND lev.Culture = @Culture;

	SELECT @Sale = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'VatItemDocType'
		  AND le.Item = 'Sale'
		  AND lev.Culture = @Culture;

	SELECT @Import = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'TradeType'
		  AND le.Item = 'Import'
		  AND lev.Culture = @Culture;

	SELECT @Internal = lev.[Value]
	FROM cfg.LocalizeEnum le
		JOIN cfg.LocalizeEnumValue lev
			ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'TradeType'
		  AND le.Item = 'Internal'
		  AND lev.Culture = @Culture;

   SELECT @ConfirmPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	   JOIN cfg.LocalizeEnumValue lev
			ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
	   AND le.Item = 'ConfirmPurchaseInvoice'
	   AND lev.Culture = @Culture
	
	SELECT @ConfirmPurchaseInvoiceItem = lev.[Value]
	FROM   cfg.LocalizeEnum le
	   JOIN cfg.LocalizeEnumValue lev
			ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	   AND le.Item = 'ConfirmPurchaseInvoiceItem'
	   AND lev.Culture = @Culture

	IF (@Type = 1)
	BEGIN
		SELECT CAST(p.PurchaseInvoiceID AS BIGINT) DocumentId,
			   'PurchaseInvoice' DocumentType,
			   @PurchaseInvoice DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   NULL ConfirmPurchaseInvoiceItemID,
			   CAST(p.Number AS NVARCHAR(100)) Number,
			   p.[Date],
			   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   pa.NonPaymented Non_Received,
			   CASE WHEN t.Type = 0 THEN @Internal
				   WHEN t.Type = 1 THEN @Import
			   END AS PurchaseType,
			   CAST(0 AS decimal) NetPay,
			   p.DlID
		FROM VND.PurchaseInvoice p
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
		   LEFT JOIN VND.PurchaseType t
				ON p.[Type] = t.PurchaseTypeID
		WHERE p.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND p.[Date] <= @Date
			  AND pa.NonPaymented > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR p.CurrencyID = @CurrencyID
			  )
			  AND p.Status = 2
			  AND t.HasConfirmStatement =0 
			  UNION ALL
			  SELECT CAST(p.PurchaseInvoiceID AS BIGINT) DocumentId,
			   'PurchaseInvoice' DocumentType,
			   @PurchaseInvoice DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   NULL ConfirmPurchaseInvoiceItemID,
			   CAST(p.Number AS NVARCHAR(100)) Number,
			   p.[Date],
			   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   pii.Tax + pii.Duty Non_Received,
			   CASE WHEN t.Type = 0 THEN @Internal
				   WHEN t.Type = 1 THEN @Import
			   END AS PurchaseType,
			   CAST(0 AS decimal) NetPay,
			   p.DlID
		FROM VND.PurchaseInvoice p
		JOIN VND.PurchaseInvoiceItem pii ON p.PurchaseInvoiceID = pii.PurchaseInvoiceID
			JOIN VND.PurchaseInvoice_NonPaymented pa
				ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
			LEFT JOIN VND.PurchaseType t
				ON p.[Type] = t.PurchaseTypeID
		WHERE p.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND p.[Date] <= @Date
			  AND pa.NonPaymented > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR p.CurrencyID = @CurrencyID
			  )
			  AND p.Status = 2
			  AND t.HasConfirmStatement = 1

			  UNION ALL 

			  SELECT CAST(ci.ConfirmPurchaseInvoiceItemID AS BIGINT) DocumentId,
			   'ConfirmPurchaseInvoiceItem' DocumentType,
			   @ConfirmPurchaseInvoiceItem DocumentName,
				C.ConfirmPurchaseInvoiceID,
				Ci.ConfirmPurchaseInvoiceItemID,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   p.[Date],
			   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   p.CurrencyRate,
			   v.NonPayment Non_Received,
			   CASE WHEN t.Type = 0 THEN @Internal
				   WHEN t.Type = 1 THEN @Import
			   END AS PurchaseType,
			   CAST(0 AS decimal) NetPay,
			   p.DlID
		FROM VND.CONfirmPurchaseInvoice c 
			  JOin VND.CONfirmPurchaseInvoiceItem ci
					on c.CONfirmPurchaseInvoiceID = ci.CONfirmPurchaseInvoiceID
			  JOIN VND.PurchaseInvoice p 
					ON p.PurchaseInvoiceID = c.PurchaseInvoiceID 
			  JOIN VND.VWCONfirmPurchaseInvoiceNONePayment v
					ON c.CONfirmPurchaseInvoiceID = v.CONfirmPurchaseInvoiceID 
			  JOIN VND.PurchaseType t 
					ON p.[Type] = t.PurchaseTypeID 
			  join CNT.AdditionDeductionType adt
					on adt.AdditionDeductionTypeID = ci.AdditionDeductionTypeID
		WHERE p.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND p.[Date] <= @Date
			  AND v.NonPayment > 0
			  AND adt.Payable = 1 -- قابل پرداخت
			  AND adt.Type = 2 --کسور
			  AND
			  (
				  @CurrencyID IS NULL
				  OR p.CurrencyID = @CurrencyID
			  )
			  AND p.Status = 2



	END;

	IF (@Type = 2)
	BEGIN

		IF OBJECT_ID('tempdb..#temp') IS NOT NULL
			DROP TABLE #temp;

		SELECT CAST(r.ReturnedSaleInvoiceID AS BIGINT) DocumentId,
			   'ReturnedSaleInvoice' DocumentType,
			   @ReturnedSaleInvoice DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   CAST(r.Number AS NVARCHAR(100)) Number,
			   r.[Date],
			   CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
			   r.CurrencyID,
			   r.CurrencyRate,
			   rsi.NonPaymented Non_Received,
			   N'' AS PurchaseType ,
			   CAST(0 AS decimal) NetPay,
			   p.DlID
		INTO #temp
		FROM SLE.ReturnedSaleInvoice r
			JOIN CFG.Party p
				ON r.CustomerID = p.PartyID
			JOIN SLE.ReturnedSaleInvoice_NonPaymented rsi
				ON r.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
		WHERE r.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND r.[Date] <= @Date
			  AND rsi.NonPaymented > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR r.CurrencyID = @CurrencyID
			  )
			  AND r.BaseDocument = 1;

		IF (@InvoiceRequested = 1)
		BEGIN
			SELECT *
			FROM #temp
			UNION
			SELECT -1 * CAST(i.InvoiceID AS BIGINT) DocumentId,
				   'Invoice' DocumentType,
				   @Sale DocumentName,
				   NULL ConfirmPurchaseInvoiceID,
				   CAST(i.Number AS NVARCHAR(100)) Number,
				   i.[Date],
				   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
				   i.CurrencyID,
				   i.CurrencyRate,
				   ABS(r.NonReceived) AS Non_Received,
				   N'' AS PurchaseType ,
				   CAST(0 AS decimal) NetPay,
				   p.DlID
			FROM SLE.Invoice i
				JOIN CFG.Party p
					ON i.CustomerID = p.PartyID
				JOIN SLE.Invoice_NonReceived r
					ON i.InvoiceID = r.InvoiceID
			WHERE i.BranchID = @BranchID
				  AND
				  (
					  @DlID IS NULL
					  OR p.DlID = @DlID
				  )
				  AND i.Date <= @Date
				  AND r.NonReceived < 0
				  AND
				  (
					  @CurrencyID IS NULL
					  OR i.CurrencyID = @CurrencyID
				  );
		END;
		ELSE
		BEGIN
			SELECT *
			FROM #temp;
		END;

		IF OBJECT_ID('tempdb..#temp') IS NOT NULL
			DROP TABLE #temp;

	END;

	IF (@Type = 3)
	BEGIN
		SELECT CAST(ii.InstallmentPaymentItemID AS BIGINT) DocumentId,
			   'Installment' DocumentType,
			   @InstallmentItem + ' ' + CAST(ii.Number AS VARCHAR(50)) + @Installment + ' ' + CAST(h.Number AS VARCHAR(50)) DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   CAST(ii.Number AS NVARCHAR(100)) Number,
			   ii.[Date],
			   CFG.GetCLRSaturnDate(ii.[Date], @DateFormat, 0, @DateType) DateString,
			   -1 CurrencyID,
			   1.00 AS CurrencyRate,
			   N'' AS PurchaseType ,
			   r.remain Non_Received,
			   CAST(0 AS decimal) NetPay,
			   p.DlID
		FROM cfg.InstallmentPayment h
			JOIN cfg.InstallmentPaymentItem ii
				ON h.InstallmentPaymentID = ii.InstallmentPaymentID
			JOIN CFG.vwInstallmentPaymentRemain r
				ON ii.InstallmentPaymentItemID = r.InstallmentPaymentItemID
			JOIN CFG.party p
				ON h.PartyId = p.PartyID
		WHERE h.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR p.DlID = @DlID
			  )
			  AND r.remain > 0
			  AND h.InstallmentType = 2
			  AND
			  (
				  @CurrencyID IS NULL
				  OR @CurrencyID = -1
			  );
	END;

	IF (@Type = 10)
	BEGIN

		SELECT @ConfigValue = LOWER(s.ConfigValue)
		FROM CFG.Configuration s
		WHERE s.ConfigKey = 'ProposalsNeededCommisionOpinion';

		SELECT CAST(c.PurchaseContractID AS BIGINT) DocumentId,
			   'PurchaseContract' DocumentType,
			   @PurchaseContract DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   CAST(c.Number AS NVARCHAR(100)) Number,
			   c.[Date],
			   CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DateString,
			   c.CurrencyID,
			   1.00 AS CurrencyRate,
			   N'' AS PurchaseType ,
			   pc.NonPaymented Non_Received,
			   CAST(0 AS decimal) NetPay,
			   c.DlID
		FROM VND.PurchaseContract c
			JOIN VND.PurchaseContract_NonPaymented pc
				ON c.PurchaseContractID = pc.PurchaseContractID
		WHERE c.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR c.DlID = @DlID
			  )
			  AND c.[Date] <= @Date
			  AND pc.NonPaymented > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR c.CurrencyID = @CurrencyID
			  )
		UNION
		SELECT -1 * CAST(p.ProposalID AS BIGINT) DocumentId,
			   'Proposal' DocumentType,
			   @Proposal DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   CAST(p.Number AS NVARCHAR(100)) Number,
			   p.[Date],
			   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
			   p.CurrencyID,
			   1.00 AS CurrencyRate,
			   N'' AS PurchaseType ,
			   pr.NonPaymented Non_Received,
			   CAST(0 AS decimal) NetPay,
			   pa.DlID
		FROM VND.Proposal p
			JOIN CFG.Party pa
				ON p.PartyID = pa.PartyID
			JOIN VND.Proposal_NonPaymented pr
				ON p.ProposalID = pr.ProposalID
		WHERE p.BranchID = @BranchID
			  AND
			  (
				  @DlID IS NULL
				  OR pa.DlID = @DlID
			  )
			  AND p.[Date] <= @Date
			  AND pr.NonPaymented > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR p.CurrencyID = @CurrencyID
			  )
			  AND
			  (
				  @ConfigValue <> 'true'
				  OR p.[Status] = 2
			  );

	END;

	IF (@Type = 11)
	BEGIN

		SELECT @ConfigValue = ConfigValue
		FROM cfg.Configuration
		WHERE ConfigKey = 'AgreementNeedConfirm';

		SELECT *
		INTO #agreement
		FROM
		(
			SELECT ROW_NUMBER() OVER (PARTITION BY a.PersonelID
									  ORDER BY CASE
												   WHEN LOWER(@ConfigValue) = 'false' THEN
													   IssueDate
												   ELSE
													   ConfirmDate
											   END DESC
									 ) Rno,
				   a.PersonelID,
				   pa.DlID
			FROM HRM.Agreement a
				JOIN HRM.Personel p
					ON a.PersonelID = p.PersonelID
				JOIN CFG.Party pa
					ON p.PartyID = pa.PartyID
			WHERE (
					  LOWER(@ConfigValue) = 'false'
					  OR ConfirmedBy IS NOT NULL
				  )
				  AND (CASE
						   WHEN LOWER(@ConfigValue) = 'false' THEN
							   IssueDate
						   ELSE
							   ConfirmDate
					   END
					  ) <= @Date
				  AND a.BranchID = @BranchID
				  AND pa.DlID = @DlID
		) A
		WHERE Rno = 1;

		SELECT CAST(c.CalculationResultID AS BIGINT) DocumentId,
			   'CalculationResult' DocumentType,
			   CASE @CultureNo
				   WHEN 1 THEN
					   ct.Title
				   WHEN 2 THEN
					   ct.Title2
			   END AS DocumentName,
			   NULL ConfirmPurchaseInvoiceID,
			   CAST(cal.[Year] AS NVARCHAR(100)) + '/' + cm.[MonthName] Number,
			   cm.StartDate [Date],
			   CFG.GetCLRSaturnDate(cm.StartDate, @DateFormat, 0, @DateType) DateString,
			   -1 CurrencyID,
			   1.00 AS CurrencyRate,
			   N'' AS PurchaseType ,
			   np.remain AS Non_Received,
			   c.[Value] NetPay,
			   a.DlID
		FROM PAY.CalculationResult c
			JOIN PAY.CalculationPersonel AS ca
				ON c.CalculationPersonelID = ca.CalculationPersonelID
			JOIN PAY.CalculationType ct
				ON ca.CalculationTypeID = ct.CalculationTypeID
			JOIN HRM.CalendarMonth cm
				ON ca.CalendarMonthID = cm.CalendarMonthID
			JOIN HRM.Calendar cal
				ON cm.CalendarID = cal.CalendarID
			JOIN pay.Parameter pa
				ON pa.ParameterID = c.ParameterID
			JOIN #agreement a
				ON ca.PersonelID = a.PersonelID
			JOIN [PAY].[CalculationResult_NonPayment] np
				ON np.CalculationResultID = c.CalculationResultID
		WHERE np.Remain > 0
			  AND
			  (
				  @CurrencyID IS NULL
				  OR @CurrencyID = -1
			  );

	END;
END;
