------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].GetReturnedOutgoingNotInReturnedSaleInvoice
    (
        @FinancialPeriodId INT
    )

--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Culture VARCHAR(10);

        SET @Culture = CFG.GetuserCulture();

        SET @UserID = CFG.GetuserID();

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

        SELECT ro.ReturnedOutgoingID ,
               ro.Number ,
               CFG.GetCLRSaturnDate(ro.Date, 'YY/MM/DD', 0, 0) PersianDate ,
               ro.StockID ,
               s.Title StockTitle ,
			   s.Title2 StockTitle2 ,
               s.Code StockCode ,
               roi.StuffID ,
               stu.Title StuffTitle ,
			   stu.Title2 StuffTitle2,
               stu.Code StuffCode ,
               b.BranchID ,
               b.Title BranchTitle ,
			   b.Title2 BranchTitle2 ,
               b.Code BranchCode ,
               ro.DlDeliverID ,
               d.Title DlTitle ,
			   d.Title2 DlTitle2 ,
               d.Code DlCode ,
               roi.MainQuantity ,
               roi.SubQuantity ,
               sdt.Title AS StockDocumentTypeTitle,
			   sdt.Title2 AS StockDocumentTypeTitle2
        FROM   STC.ReturnedOutgoing ro
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
               JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
               JOIN STC.ReturnedOutgoingItem roi ON roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
               JOIN STF.[Stuff] stu ON stu.StuffID = roi.StuffID
               JOIN ACC.DL d ON d.DLID = ro.DlDeliverID
               JOIN STF.Stock s ON s.StockID = ro.StockID
               JOIN CFG.Branch b ON b.BranchID = s.BranchID
               LEFT JOIN SLE.ReturnedSaleInvoiceItem rsii ON rsii.ReturnedOutgoingItemID = roi.ReturnedOutgoingItemID
               INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = b.BranchID
               INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = ro.StockID
        WHERE  rsii.ReturnedSaleInvoiceItemID IS NULL
		and roi.ReturnedSaleInvoiceItemID is null
               AND ro.FinancialPeriodID = @FinancialPeriodId
               AND (   sdt.DocumentType = 1
                       OR sdt.DocumentType = 10 );

    END;

