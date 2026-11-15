
------------------------------------------------
CREATE    PROCEDURE CFG.MonitoringActivity_GetReturnStockWithoutReturnInvoice
(@FinancialPeriodId INT)

--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

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
        
        SELECT * into #vwStockAccess
        FROM cfg.vwStockAccess AS vsa
        
        SELECT * into #vwStuff
        FROM stf.VWStuff AS v

    SELECT rsri.ReturnStockReceiptItemID,
           rsr.ReturnStockReceiptID,
           rsri.RowIndex,
           rsr.Number,
           CFG.GetCLRSaturnDate(rsr.[Date], @DateFormat, 0, @DateType) [Date],
           sdt.Title StockDocumentTypeTitle,
           sdt.Title2 StockDocumentTypeTitle2,
           rsr.DeliverDlID,
           d.Title DlTitle,
           d.Title2 DlTitle2,
           d.Code DlCode,
           st.Title StuffTitle,
           st.Title2 StuffTitle2,
            st.code StuffCode,
           rsri.MainQuantity
    FROM STC.ReturnStockReceiptItem AS rsri
        JOIN STC.ReturnStockReceipt AS rsr on rsr.ReturnStockReceiptID = rsri.ReturnStockReceiptID        
        JOIN STC.StockDocumentTypeBaseEntity sdtb
            ON sdtb.StockDocumentTypeBaseEntityID = rsr.StockDocumentTypeBaseEntityID
        left join vnd.ReturnInvoiceItem AS rii on rii.ReturnStockReceiptItemID = rsri.ReturnStockReceiptItemID    
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN ACC.DL d
            ON d.DLID = rsr.DeliverDlID
        JOIN #vwStuff st
            ON st.StuffID = rsri.StuffID
        INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = rsr.StockID
    WHERE rii.ReturnInvoiceItemID IS NULL
          AND sdt.Type = 1
          AND sdt.DocumentType = 1
          AND rsr.FinancialPeriodID = @FinancialPeriodId
    ORDER BY rsri.StockReceiptItemID;

END;
