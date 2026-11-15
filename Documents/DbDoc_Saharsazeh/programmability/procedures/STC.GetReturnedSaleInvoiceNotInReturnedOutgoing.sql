CREATE   PROCEDURE [STC].GetReturnedSaleInvoiceNotInReturnedOutgoing
(
    @FinancialPeriodId INT
)
--WITH ENCRYPTION
AS
BEGIN
	--"ReturnedSaleInvoiceNotInReturnedOutgoing": "برگشت فروش های فاقد برگشت حواله",
	DECLARE @UserID INT ,
			@DateType TINYINT ,
			@DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @CultureNo VARCHAR(10)
		
    SET @UserID = CFG.GetuserID();	
    SET @Culture = CFG.GetuserCulture();

    SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID;
	
    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                          WHEN 'fa' THEN 0
                          WHEN 'en' THEN 1
                          WHEN 'ar' THEN 2
                        END;
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID;
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;  

	SELECT  rsi.ReturnedSaleInvoiceID,
			rsii.ReturnedSaleInvoiceItemID,
			rsi.Number,
			CFG.GetCLRSaturnDate( rsi.Date, @DateFormat, 0, @DateType) PersianDate ,
			rsi.Date,
			SaleType.Title AS SaleTypeTitle,
			Branch.Code AS BranchCode,
			Branch.Title AS BranchTitle,
			SaleArea.Code AS SaleAreaCode,
			SaleArea.Title AS SaleAreaTitle,
			DL.Code AS CustomerCode,
			DL.Title AS CustomerTitle,
			rsii.MainQuantity,
			rsii.SubQuantity,
			SaleType.Title2 AS SaleTypeTitle2,
			Branch.Title2 AS BranchTitle2,
			SaleArea.Title2 AS SaleAreaTitle2,
			DL.Title2 AS CustomerTitle2,
			s.Code As StuffCode,
			CASE @CultureNo WHEN 2 THEN s.Title2 ELSE s.Title END AS StuffTitle
	FROM SLE.ReturnedSaleInvoice rsi
		JOIN SLE.ReturnedSaleInvoiceItem rsii 
				ON rsi.ReturnedSaleInvoiceID = rsii.ReturnedSaleInvoiceID
		JOIN STF.VWStuff s 
				ON rsii.StuffID = s.StuffID
		JOIN SLE.SaleType SaleType 
				ON rsi.SaleTypeID = SaleType.SaleTypeID
		JOIN CFG.Branch Branch
				ON rsi.BranchID = Branch.BranchID 
		JOIN SLE.SaleArea SaleArea
				ON rsi.SaleAreaID = SaleArea.SaleAreaID
		JOIN CFG.Party Party 
				ON rsi.CustomerID = Party.PartyID
		JOIN ACC.DL DL
				ON Party.DlID = DL.DLID
		LEFT JOIN STC.ReturnedOutgoingItem ReturnedOutgoingItem
				ON rsii.ReturnedSaleInvoiceItemID = ReturnedOutgoingItem.ReturnedSaleInvoiceItemID
		INNER JOIN cfg.vwBranchAccess vwBranchAccess 
				ON rsi.BranchID = vwBranchAccess.BranchID
	WHERE rsii.ReturnedOutgoingItemID IS NULL AND ReturnedOutgoingItem.ReturnedOutgoingItemID IS NULL
	and rsi.FinancialPeriodID = @FinancialPeriodId
	and s.type = 0
END;
