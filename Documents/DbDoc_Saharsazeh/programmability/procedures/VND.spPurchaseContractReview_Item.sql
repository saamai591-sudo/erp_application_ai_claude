------------------------------------- START #8076
CREATE   PROCEDURE [VND].spPurchaseContractReview_Item
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedBranch NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedPurchaseType NVARCHAR(MAX) = NULL,
    @SelectedVendor NVARCHAR(MAX) = NULL)
AS 
BEGIN

    DECLARE @TableName NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @Culture NVARCHAR(10),
            @CultureNo TINYINT,
            @UserID INT,
            @userCulture NVARCHAR(20),
            @DateType TINYINT,
            @DateFormat VARCHAR(10);
            
    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    DROP TABLE IF EXISTS #vwEnums

    SELECT * INTo #vwEnums FROM cfg.VwEnums AS ve
	       WHERE enum = 'VendorStatus'
	       and ve.KeyValue is NOT NULL

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                            ELSE 0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';
	
    SET @TableName = cfg.getTempTableName(1);

    SET @Culture = CFG.GetuserCulture();

    EXEC vnd.spPurchaseContractReviewDataSource
        @FromDate = @FromDate,
        @ToDate = @ToDate,
        @TableName = @TableName,
        @SelectedBranch = @SelectedBranch,	 
        @SelectedStuff = @SelectedStuff,	
        @SelectedPurchaseType = @SelectedPurchaseType,
        @SelectedVendor = @SelectedVendor

		declare @WithoutBase nvarchar(20),
				@PurchaseRequest nvarchar(20),
				@Proposal nvarchar(20),
				@StuffRequest nvarchar(20)

	set @Culture = cfg.GetuserCulture()

	SELECT @WithoutBase = le.value FROM CFG.LocalizeEnum L
	JOIN CFG.LocalizeEnumValue le ON L.LocalizeEnumID = le.LocalizeEnumID
	where l.Enum= 'PurchaseDocumentBases' and l.Item = 'WithoutBase' and le.Culture = @Culture

	SELECT @PurchaseRequest = le.value FROM CFG.LocalizeEnum L
	JOIN CFG.LocalizeEnumValue le ON L.LocalizeEnumID = le.LocalizeEnumID
	where l.Enum= 'PurchaseDocumentBases' and l.Item = 'PurchaseRequest' and le.Culture = @Culture

	SELECT @Proposal = le.value FROM CFG.LocalizeEnum L
	JOIN CFG.LocalizeEnumValue le ON L.LocalizeEnumID = le.LocalizeEnumID
	where l.Enum= 'PurchaseDocumentBases' and l.Item = 'Proposal' and le.Culture = @Culture

	SELECT @StuffRequest= le.value FROM CFG.LocalizeEnum L
	JOIN CFG.LocalizeEnumValue le ON L.LocalizeEnumID = le.LocalizeEnumID
	where l.Enum= 'PurchaseDocumentBases' and l.Item = 'StuffRequest' and le.Culture = @Culture

    SET @Query = '
     SELECT 
        CASE WHEN @CultureNo = 2 THEN pt.Title2 ELSE pt.Title END AS PurchaseType,
        pc.Number,
        pc.Status,
        ve.Value AS StatusString,
        CFG.GetCLRSaturnDate(pc.[Date], ''YY/MM/DD'', 0, '''') AS [Date_Date],
		CASE 
			WHEN pc.BaseType = 1 THEN @WithoutBase
			WHEN pc.BaseType = 2 then @PurchaseRequest
			WHEN pc.BaseType = 5 then @Proposal
			WHEN pc.BaseType = 7 then @StuffRequest
		END AS BaseType,
        CASE 
			WHEN pc.BaseType = 1 then NULL
			WHEN pc.BaseType = 2 then pr.PurchaseRequestNumber
			WHEN pc.BaseType = 5 then pl.Number
			WHEN pc.BaseType = 7 then sr.StuffRequestNumber				
		END AS  BaseNumber,
        d.Code AS DlCode,
        CASE WHEN @CultureNo = 2 THEN d.Title2 ELSE d.Title END AS DlTitle,
		pc.InvoiceNumber AS PurchaseInvoiceNumber,
		CFG.GetCLRSaturnDate(pc.InvoiceDate, ''YY/MM/DD'', 0, '''') AS PurchaseContractDate,
        CASE WHEN @CultureNo = 2 THEN c.Title2 ELSE c.Title END AS CurrencyTitle,
        s.Code AS StuffCode,
        CASE WHEN @CultureNo = 2 THEN s.Title2 ELSE s.Title END AS StuffTitle,
        pci.MainQuantity AS MainQuantity,
        pci.SubQuantity AS SubQuantity,
        pci.Fee,
		pci.Price,
        pci.Discount,
        (pci.Tax + pci.Duty) AS Vat,
        pci.Net,
        pci.PurchaseContractItemID,
		a.TemporaryStockReceiptQuantity TotalTemporaryReceiptQuantity,
		a.JustificationInputQuantity TotalJustificationInputQuantity,
		a.StockReceiptQuantity TotalStockReceiptQuantity,
		a.PurchaseInvoiceQuantity TotalPurchaseInvoiceQuantity,
        (pci.MainQuantity - ISNULL(a.TemporaryStockReceiptQuantity, 0)) AS RemainTemporaryReceiptQuantity,
		(pci.MainQuantity - ISNULL(a.JustificationInputQuantity, 0)) AS RemainJustificationInputQuantity,
		(pci.MainQuantity - ISNULL(a.StockReceiptQuantity, 0)) AS RemainStockReceiptQuantity,
		(pci.MainQuantity - ISNULL(a.PurchaseInvoiceQuantity, 0)) AS RemainPurchaseInvoiceQuantity,
		CASE WHEN @CultureNo = 2 THEN pci.Description2 ELSE pci.Description END AS PurchaseContractDescription,
        ''PurchaseContract'' AS Document,
        pc.PurchaseContractID
    FROM vnd.PurchaseContractItem pci 
    JOIN ' + @TableName + ' a ON a.PurchaseContractItemID = pci.PurchaseContractItemID
    JOIN  stf.VWStuff s ON pci.StuffID = s.StuffID
	LEFT JOIN REQ.PurchaseRequestItem pri ON pci.PurchaseRequestItemID = pri.PurchaseRequestItemID	
    JOIN vnd.PurchaseContract pc ON pci.PurchaseContractID = pc.PurchaseContractID
    LEFT JOIN #vwEnums ve on pc.status = ve.keyValue
    JOIN vnd.PurchaseType pt ON pc.Type = pt.PurchaseTypeID
    JOIN acc.dl d ON pc.Dlid = d.DlID
    JOIN cfg.Currency c ON pc.CurrencyID = c.CurrencyID
    JOIN  cfg.Branch b ON pc.BranchID = b.BranchID
	LEFT JOIN REQ.PurchaseRequest pr ON pri.PurchaseRequestID = pr.PurchaseRequestID
	LEFT JOIN VND.ProposalItem pli ON pci.ProposalItemID = pli.ProposalItemID
	LEFT JOIN VND.Proposal pl ON pli.ProposalID = pl.ProposalID
	LEFT JOIN  REQ.StuffRequestItem stri ON stri.StuffRequestItemID = pci.StuffRequestItemID
	LEFT JOIN REQ.StuffRequest sr ON stri.StuffRequestID = sr.StuffRequestID
	WHERE pc.[Date] BETWEEN @FromDate AND @ToDate
    ';

    EXECUTE sp_executesql @query,
        N'@FromDate DATE,
		  @ToDate DATE,
	      @CultureNo TINYINT,
		  @WithoutBase			 nvarchar(20),
		  @PurchaseRequest			nvarchar(20),
		  @Proposal					nvarchar(20),
		  @StuffRequest				nvarchar(20)
		  ',
        @CultureNo = @CultureNo,
		@FromDate =@FromDate,
		@ToDate =@ToDate,
		 @WithoutBase			= @WithoutBase			,
		 @PurchaseRequest		= @PurchaseRequest		,
		 @Proposal				= @Proposal				,
		 @StuffRequest			= @StuffRequest			
END;
