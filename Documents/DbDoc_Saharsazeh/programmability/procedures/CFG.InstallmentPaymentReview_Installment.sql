CREATE PROCEDURE [CFG].InstallmentPaymentReview_Installment
(
    @Branch                 VARCHAR(MAX) = NULL,
    @InstallmentItem        VARCHAR(MAX) = NULL,
    @InstallmentPayItem     VARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID         INT,
	        @DateType       TINYINT,
	        @DateFormat     VARCHAR(10),
	        @Culture        VARCHAR(10),
	        @CultureNo      TINYINT;
	
	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
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

	DECLARE @Payment                 NVARCHAR(100),
	        @Recive     NVARCHAR(100),
	        @Invoice                NVARCHAR(100),
	        @PurchaseInvoice                  NVARCHAR(100),
			@StoleSaleBalance  NVARCHAR(100),
			@WithoutBase NVARCHAR(100)
	
	SELECT @Payment =   lev.[Value] 
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentTypes'
	       AND le.Item = 'Payment'
	       AND lev.Culture = @Culture;

	SELECT @Recive =  lev.[Value] 
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentTypes'
	       AND le.Item = 'Recive'
	       AND lev.Culture = @Culture;

	SELECT @Invoice =  lev.[Value] 
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentBaseTypes'
	       AND le.Item = 'Invoice'
	       AND lev.Culture = @Culture;

	SELECT @PurchaseInvoice =lev.[Value] 
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentBaseTypes'
	       AND le.Item = 'PurchaseInvoice'
	       AND lev.Culture = @Culture;

	SELECT @StoleSaleBalance =  lev.[Value]
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentBaseTypes'
	       AND le.Item = 'StoleSaleBalance'
	       AND lev.Culture = @Culture;

	SELECT @WithoutBase =  lev.[Value] 
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'InstallmentPaymentBaseTypes'
	       AND le.Item = 'WithoutBase'
	       AND lev.Culture = @Culture;

	SELECT ip.InstallmentPaymentID,
	       ip.Number,
	       ip.[Date],
	       CFG.GetCLRSaturnDate(ip.[Date], @DateFormat, 0, @DateType) AS [Date_Date],
	       CASE ip.InstallmentType
	            WHEN 1 THEN @Recive
	            ELSE @Payment
	       END                     AS [Type],
			   CASE ip.BaseType
					WHEN 1 THEN @WithoutBase
					WHEN 2 THEN @Invoice
					WHEN 3 THEN @StoleSaleBalance
					ELSE @PurchaseInvoice
			   END                     AS Base,
	       case when ip.BaseType = 4 then isnull(pur.InvoiceNumber,pur.Number)
				when ip.BaseType = 2 then cast(i.Number as nvarchar(20)) end  AS DocumentNumber,
	       CASE 
	            WHEN @CultureNo = 1 THEN p.Title + ' ' + ISNULL(p.LastName, '')
	            WHEN @CultureNo = 2 THEN p.Title2 + ' ' + ISNULL(p.LastName2, '')
	       END                     AS PartyTitle,
	       (
	           SELECT SUM(Amount)
	           FROM   CFG.InstallmentPaymentItem AS ipi
	           WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	       )                       AS Amount,
	       CASE 
	            WHEN @CultureNo = 1 THEN Currency.Title
	            WHEN @CultureNo = 2 THEN Currency.Title2
	       END                     AS CurrencyTitle
	FROM   CFG.InstallmentPayment  AS ip
	INNER JOIN CFG.Party    AS p
	    ON  p.PartyID = ip.PartyId
	INNER JOIN CFG.Currency on Currency.CurrencyID = ip.CurrencyID
	left join vnd.PurchaseInvoice pur on pur.PurchaseInvoiceID = ip.DocumentID and ip.BaseType = 4
	left join sle.Invoice i on i.InvoiceID = ip.DocumentID and ip.BaseType = 2

	WHERE  (
	           @Branch IS NULL
	           OR ip.BranchId IN (SELECT VALUE
	                              FROM   CFG.R_FnCommaStr2Table(@Branch) AS rfcst)
	       )
	       AND (
	               @InstallmentItem IS NULL
	               OR EXISTS (
	                      SELECT 1
	                      FROM   CFG.InstallmentPaymentItem AS ipi
	                             INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentItem) AS rfcst
	                                  ON  ipi.InstallmentPaymentItemID = rfcst.[value]
	                      WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                  )
	           )
	       AND (
	               @InstallmentPayItem IS NULL
	               OR EXISTS (
	                      SELECT 1
	                      FROM   CFG.InstallmentPaymentItem AS ipi
	                             INNER JOIN FIN.PaymentSubject AS ps
	                                  ON  ps.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                             INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                  ON  (3 * 1000000)
	                                      + (ps.PaymentSubjectID) = rfcst.[value]
	                      WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                  )
	               OR EXISTS (
	                      SELECT 1
	                      FROM   CFG.InstallmentPaymentItem AS ipi
	                             INNER JOIN FIN.ReceiveSubject AS rs
	                                  ON  rs.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                             INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                  ON  (2 * 1000000)
	                                      + rs.ReceiveSubjectID = rfcst.[value]
	                      WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                  )
	               OR EXISTS (
	                      SELECT 1
	                      FROM   CFG.InstallmentPaymentItem AS ipi
	                             INNER JOIN CFG.ManualReceipt AS mr
	                                  ON  mr.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                             INNER JOIN CFG.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                  ON  (4 * 1000000)
	                                      + mr.ManualReceiptID = rfcst.[value]
	                      WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                  )
	           )
