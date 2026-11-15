
CREATE   PROCEDURE [FIN].spGetBaseDocumentForReceiveReceipt
(
    @Type           TINYINT,
    @BranchID       INT,
    @DlID           BIGINT = NULL,
    @Date           DATE = NULL,
    @CurrencyID     INT = NULL,
	@PurchaseInvoiceRequested bit = 0,
	@ComeFromManualReceipt bit = 0
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID               INT,
	        @DateType             TINYINT,
	        @DateFormat           VARCHAR(10),
			@Sale                 NVARCHAR(100),
	        @PurchaseInvoice      NVARCHAR(100),
	        @ReturnedPurchase     NVARCHAR(100),
	        @ConfigValue          VARCHAR(10),
	        @Culture              VARCHAR(10)
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD'
	
	SELECT @Sale = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'VatItemDocType'
	       AND le.Item = 'Sale'
	       AND lev.Culture = @Culture

	SELECT @PurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'PurchaseInvoice'
	       AND lev.Culture = cfg.GetuserCulture()
	
	SELECT @ReturnedPurchase = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'VatItemDocType'
	       AND le.Item = 'ReturnedPurchase'
	       AND lev.Culture = @Culture
	
	IF (@Type = 1)
	begin
		if @ComeFromManualReceipt = 0
		begin
		select @ConfigValue = LOWER(ConfigValue) from CFG.Configuration where ConfigKey = 'QuotationNeedConfirm'

		SELECT CAST(i.QuotationID AS BIGINT) AS DocumentId,
	           'Quotation'         DocumentType,
	           'پیش فاکتور'             DocumentName,
	           CAST(i.Number AS VARCHAR(100)) Number,
	           i.[Date] [Date],
			   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
	           i.CurrencyID      CurrencyID,
	           r.UnpaidBalance     Non_Received
	    FROM   SLE.Quotation i
	           JOIN CFG.Party p
	                ON  i.CustomerID = p.PartyID
	           JOIN SLE.Quotation_UnpaidBalance r
	                ON  i.QuotationID = r.QuotationID
	    WHERE  i.BranchID = @BranchID
	           AND p.DlID = @DlID
	           AND r.UnpaidBalance > 0
	           AND (@ConfigValue <> 'true' OR i.[Status] = 3)
	           AND i.[Status] <> 2
	           AND (@date IS NULL OR i.date <= @Date)
	           AND (@CurrencyID IS NULL OR i.CurrencyID = @CurrencyID)

		union

		SELECT -1 * CAST(i.SaleContractID AS BIGINT) AS DocumentId,
	           'SaleContract'         DocumentType,
	           'قرارداد فروش'             DocumentName,
	           CAST(i.Number AS VARCHAR(100)) Number,
	           i.[Date] [Date],
			   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
	           i.CurrencyID      CurrencyID,
	           r.UnpaidBalance     Non_Received
	    FROM   SLE.SaleContract i
	           JOIN CFG.Party p
	                ON  i.CustomerID = p.PartyID
	           JOIN SLE.SaleContract_UnpaidBalance r
	                ON  i.SaleContractID = r.SaleContractID
	    WHERE  i.BranchID = @BranchID
	           AND p.DlID = @DlID
	           AND r.UnpaidBalance > 0	           
	           AND (@date IS NULL OR i.date <= @Date)
	           AND (@CurrencyID IS NULL OR i.CurrencyID = @CurrencyID)
		end
		else
		begin
		SELECT CAST(i.SaleContractID AS BIGINT) AS DocumentId,
	           'SaleContract'         DocumentType,
	           'قرارداد فروش'             DocumentName,
	           CAST(i.Number AS VARCHAR(100)) Number,
	           i.[Date] [Date],
			   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
	           i.CurrencyID      CurrencyID,
	           r.UnpaidBalance     Non_Received
	    FROM   SLE.SaleContract i
	           JOIN CFG.Party p
	                ON  i.CustomerID = p.PartyID
	           JOIN SLE.SaleContract_UnpaidBalance r
	                ON  i.SaleContractID = r.SaleContractID
	    WHERE  i.BranchID = @BranchID
	           AND p.DlID = @DlID
	           AND r.UnpaidBalance > 0	           
	           AND (@date IS NULL OR i.date <= @Date)
	           AND (@CurrencyID IS NULL OR i.CurrencyID = @CurrencyID)
		end
	end

	IF (@Type = 2)
	BEGIN
	    SELECT @ConfigValue = LOWER(s.ConfigValue)
	    FROM   CFG.Configuration s
	    WHERE  s.ConfigKey = 'InvoiceNeedConfirm'
	    
	    SELECT CAST(i.InvoiceID AS BIGINT) AS DocumentId,
	           'Invoice'         DocumentType,
	           @Sale             DocumentName,
	           CAST(i.Number AS VARCHAR(100)) Number,
	           i.[Date] [Date],
			   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
	           i.CurrencyID      CurrencyID,
	           r.NonReceived     Non_Received
	    FROM   SLE.Invoice i
	           JOIN CFG.Party p
	                ON  i.CustomerID = p.PartyID
	           JOIN SLE.Invoice_NonReceived r
	                ON  i.InvoiceID = r.InvoiceID
	    WHERE  i.BranchID = @BranchID
	           AND p.DlID = @DlID
	           AND r.NonReceived > 0
	           AND (@ConfigValue <> 'true' OR i.SaleInvoiceStatus = 2)
	           AND i.SaleInvoiceStatus <> 5
	           AND (@date IS NULL OR i.date <= @Date)
	           AND (@CurrencyID IS NULL OR i.CurrencyID = @CurrencyID)
	END
	
	IF (@Type = 3)
	BEGIN
	    SELECT CAST(ii.InstallmentPaymentItemID AS BIGINT) DocumentId,
	           'Installment'     DocumentType,
	           'قسط شماره ' + CAST(h.Number AS VARCHAR(50)) DocumentName,
	           CAST(ii.Number AS VARCHAR(100)) Number,
	           ii.[Date] [Date],
			   CFG.GetCLRSaturnDate(ii.[Date], @DateFormat, 0, @DateType) DateString,
	           -1      CurrencyID,
	           r.remain          Non_Received
	    FROM   cfg.InstallmentPayment h	                
	           JOIN cfg.InstallmentPaymentItem ii
	                ON  h.InstallmentPaymentID = ii.InstallmentPaymentID
	           JOIN CFG.Party p
	                ON  h.partyid = p.PartyID
	           JOIN CFG.vwInstallmentPaymentRemain r
	                ON  ii.InstallmentPaymentItemID = r.InstallmentPaymentItemID
	    WHERE  h.BranchID = @BranchID
	           AND p.DlID = @DlID
	           AND r.remain > 0
	           AND (@date IS NULL OR h.[Date] <= @Date)
			   AND h.InstallmentType = 1
	END
	
	IF (@Type = 4)
	BEGIN
		
		if object_id('tempdb..#temp') is not null
			drop table #temp

	    SELECT CAST(r.ReturnInvoiceID AS BIGINT) DocumentId,
	           'ReturnInvoice'       DocumentType,
	           @ReturnedPurchase     DocumentName,
	           CAST(r.Number AS VARCHAR(100)) Number,
	           r.[Date] [Date],
			   CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) DateString,
	           r.CurrencyID,
	           r.Non_Received
		into #temp
	    FROM   VND.ReturnInvoice     r	
		join (select a.ReturnInvoiceID,count(*) CountOfPurchaseInvoices
			       from VND.ReturnInvoiceItem a
				   where a.PurchaseInvoiceItemID is null
			       group by a.ReturnInvoiceID) i on r.ReturnInvoiceID = i.ReturnInvoiceID and i.CountOfPurchaseInvoices > 0
	    WHERE  r.BranchID = @BranchID
	           AND r.DlID = @DlID
	           AND r.Non_Received > 0
	           AND (@date IS NULL OR r.date <= @Date)
	           AND (@CurrencyID IS NULL OR r.CurrencyID = @CurrencyID)
			   
		if (@PurchaseInvoiceRequested = 1)
		begin
			select DocumentId,
                     DocumentType,
                     DocumentName,
                     Number,
                     [Date],
                     DateString,
                     CurrencyID,
                     Non_Received   
			from #temp
			union
			SELECT -1 * CAST(p.PurchaseInvoiceID AS Bigint) DocumentId, 
				   'PurchaseInvoice'     DocumentType,
				   @PurchaseInvoice      DocumentName,
				   ISNULL(InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
				   p.[Date],
				   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
				   p.CurrencyID,
				   abs(pa.NonPaymented) as Non_Received			   
			FROM   VND.PurchaseInvoice p
				   JOIN VND.PurchaseInvoice_NonPaymented pa
						ON  p.PurchaseInvoiceID = pa.PurchaseInvoiceID
				   JOIN VND.PurchaseType t on p.[Type] = t.PurchaseTypeID
			WHERE  p.BranchID = @BranchID
				   AND p.DlID = @DlID
				   AND pa.NonPaymented < 0
				   AND (@Date IS NULL OR p.Date <= @Date)
				   AND (@CurrencyID IS NULL OR p.CurrencyID = @CurrencyID)
		end
		else
		begin
			select * from #temp
		end		

		if object_id('tempdb..#temp') is not null
			drop table #temp

	END
END

