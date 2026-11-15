-------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [CFG].MonitoringActivity_GetPurchaseInvocieWithoutStockReceipt
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
            
            
        SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba

        SELECT pii.PurchaseInvoiceItemID ,
               pii.PurchaseInvoiceID ,
               pii.RowIndex ,
               pin.Number ,
               CFG.GetCLRSaturnDate(pin.[Date], @DateFormat, 0, @DateType) [Date] ,
               s.Title StuffTitle ,
			   s.Title2 StuffTitle2,
               [STF].[GetStuffCode](s.StuffID) StuffCode ,
               d.Title DlTitle ,
			   d.Title2 DlTitle2 ,
               d.Code DlCode ,
               pii.Net ,
               pir.Non ,
               pir.NonSub
        FROM   VND.PurchaseInvoiceItem pii
               JOIN VND.PurchaseInvoice_Remains pir ON pir.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
			   JOIN VND.PurchaseInvoice_PriceRemains pipr ON pipr.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
               JOIN VND.PurchaseInvoice pin ON pin.PurchaseInvoiceID = pii.PurchaseInvoiceID
               JOIN STF.VWStuff s ON s.StuffID = pii.StuffID
               JOIN ACC.DL d ON d.DLID = pin.DlID
			   INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = pin.BranchID
        WHERE  pii.ProformaInvoiceItemID IS NULL
               AND pir.Non > 0
			   AND pipr.Non > 0
               AND pin.BaseType <> 6
               AND s.[Type] = 0
               AND pin.FinancialPeriodID = @FinancialPeriodId

    END;
