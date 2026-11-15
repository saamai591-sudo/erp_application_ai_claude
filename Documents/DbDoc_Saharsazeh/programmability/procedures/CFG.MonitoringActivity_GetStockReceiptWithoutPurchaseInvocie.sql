
---------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [CFG].MonitoringActivity_GetStockReceiptWithoutPurchaseInvocie
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

    SELECT sri.StockReceiptItemID,
           sr.StockReceiptID,
           sri.RowIndex,
           sr.Number,
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) [Date],
           sdt.Title,
           sdt.Title2,
           sr.DeliverDlID,
           d.Title DlTitle,
           d.Title2 DlTitle2,
           d.Code DlCode,
           st.Title StuffTitle,
           st.Title2 StuffTitle2,
            [STF].[GetStuffCode](st.StuffID) StuffCode,
           sri.MainQuantity,
           sri.SubQuantity
    FROM STC.StockReceiptItem sri
        LEFT JOIN
        (
            SELECT pii.StockReceiptItemID
            FROM VND.PurchaseInvoiceItem AS pii
            GROUP BY pii.StockReceiptItemID
        ) useItem
            ON useItem.StockReceiptItemID = sri.StockReceiptItemID
        JOIN STC.StockReceipt sr
            ON sr.StockReceiptID = sri.StockReceiptID
        JOIN STC.StockDocumentTypeBaseEntity sdtb
            ON sdtb.StockDocumentTypeBaseEntityID = sr.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN ACC.DL d
            ON d.DLID = sr.DeliverDlID
        JOIN STF.[Stuff] st
            ON st.StuffID = sri.StuffID
        INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = sr.StockID
    WHERE PurchaseInvoiceItemID IS NULL
          AND sri.ClearanceItemID IS NULL
          AND sdt.Type = 1
          AND sdt.DocumentType = 1
          AND sr.FinancialPeriodID = @FinancialPeriodId
          AND useItem.StockReceiptItemID IS NULL
    ORDER BY sri.StockReceiptItemID;

END;

