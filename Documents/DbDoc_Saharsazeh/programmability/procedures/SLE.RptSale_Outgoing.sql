------------------------------------------------------------------------------------------------------------------
CREATE   PROC [SLE].RptSale_Outgoing
(
    @FinancialPeriod INT,
    @FromDate DATE,
    @EndDate DATE,
    ----------------------------------
    @Justifications VARCHAR(MAX) = NULL,
    @Quotations VARCHAR(MAX) = NULL,
    @Remittances VARCHAR(MAX) = NULL,
    @Invoices VARCHAR(MAX) = NULL,
    @ReturnedSale VARCHAR(MAX) = NULL,
    @ReturnJustification VARCHAR(MAX) = NULL,
    @Items VARCHAR(MAX) = NULL,
    @Orders VARCHAR(MAX) = NULL
--------------------------------------
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @WithOutbase NVARCHAR(100),
            @Remittance NVARCHAR(100),
            @Justification NVARCHAR(100),
            @Quotation NVARCHAR(100),
            @Invoice NVARCHAR(100),
            @Reception NVARCHAR(100),
            @TemporaryOutgoing NVARCHAR(100),
            @Culture VARCHAR(10),
            @userid INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;

    SET @userid = CFG.GetuserID();

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;


    SELECT @TemporaryOutgoing = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'OutgoingBaseTypes'
          AND le.Item = 'TemporaryOutgoing'
          AND lev.Culture = @Culture;

    SELECT @Reception = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Reception'
          AND lev.Culture = @Culture;

    SELECT @WithOutbase = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'WithOutbase'
          AND lev.Culture = @Culture;

    SELECT @Remittance = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Remittance'
          AND lev.Culture = @Culture;

    SELECT @Invoice = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Invoice'
          AND lev.Culture = @Culture;

    SELECT @Quotation = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Quotation'
          AND lev.Culture = @Culture;

    SELECT @Justification = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Justification'
          AND lev.Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userid;

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
          AND us.UserID = @userid;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT CFG.GetStringPartBySpliter(value, 1, '#') DocType,
           CFG.GetStringPartBySpliter(value, 2, '#') DocID
    INTO #Items
    FROM CFG.Split(@Items, '|');

    SELECT PrevoucherID,
           VoucherID
    INTO #VP
    FROM ACC.VoucherPrevoucher
    GROUP BY PrevoucherID,
             VoucherID;

   

    SELECT DISTINCT
           a.OutgoingID
    INTO #tt
    FROM
    (
        SELECT rsii.ReturnedSaleInvoiceItemID,
               oi.OutgoingID,
               rsii.ReturnedSaleInvoiceID
        FROM SLE.ReturnedSaleInvoiceItem AS rsii
            JOIN STC.ReturnedOutgoingItem AS roi
                ON roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
            JOIN STC.OutgoingItem AS oi
                ON oi.OutgoingItemID = roi.OutgoingItemID
        UNION
        SELECT rsii.ReturnedSaleInvoiceItemID,
               oi2.OutgoingID,
               rsii.ReturnedSaleInvoiceID
        FROM SLE.ReturnedSaleInvoiceItem AS rsii
            JOIN STC.ReturnedOutgoingItem AS roi
                ON roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
            JOIN SLE.InvoiceItem AS ii
                ON ii.InvoiceItemID = rsii.InvoiceItemID
            JOIN STC.OutgoingItem AS oi2
                ON oi2.InvoiceItemID = ii.InvoiceItemID
        WHERE roi.OutgoingItemID IS NULL
    ) AS a
    WHERE a.ReturnedSaleInvoiceID IN
          (
              SELECT value FROM CFG.R_FnCommaStr2Table(@ReturnedSale)
          );


    SELECT DISTINCT
           j.OutgoingID,
           CASE sdtb.BaseEntity
               WHEN 1 THEN @WithOutbase
               WHEN 3 THEN @Justification
               WHEN 4 THEN @Quotation
               WHEN 5 THEN @Remittance
               WHEN 6 THEN @Invoice
               WHEN 8 THEN @Reception
               WHEN 7 THEN @TemporaryOutgoing
           END AS BaseDocument,
           s.Code AS StockCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               WHEN @CultureNo = 2 THEN
                   s.Title2
           END AS StockTitle,
           CASE
               WHEN @CultureNo = 1 THEN
                   d.Title
               WHEN @CultureNo = 2 THEN
                   d.Title2
           END AS PartyTitle,
           d.Code AS DLCode,
           j.Number,
           j.[Date],
           CFG.GetCLRSaturnDate(j.[Date], @DateFormat, 0, @DateType) AS [Date_Date],
           j.TotalPrice,
           v.Number VoucherNumber,
           v.[Date] AS VoucherDate,
           CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate
    FROM STC.Outgoing AS j
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
        ON j.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.OutgoingItem oi
            ON oi.OutgoingID = j.OutgoingID
        JOIN ACC.DL d
            ON d.DLID = j.DeliverDlID
        JOIN cfg.Party AS prt ON prt.DlID = d.DLID    
        JOIN STC.StockDocumentType AS sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN STF.Stock s
            ON s.StockID = j.StockID
        LEFT JOIN #VP
            ON #VP.PrevoucherID = j.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = #VP.VoucherID
        --------------------------------------
        LEFT JOIN SLE.Justification_Outgoing AS jo
            ON jo.OutgoingItemID = oi.OutgoingItemID
        --------------------------------------
        LEFT JOIN SLE.JustificationItem AS ji
            ON jo.JustificationItemID = ji.JustificationItemID
        --------------------------------------
        LEFT JOIN SLE.Quotation_Outgoing AS qo
            ON qo.OutgoingItemID = oi.OutgoingItemID
        --------------------------------------
        LEFT JOIN SLE.QuotationItem AS qi
            ON qi.QuotationItemID = qo.QuotationItemID
        --------------------------------------
        LEFT JOIN SLE.Remittance_Outgoing AS ro
            ON ro.OutgoingItemID = oi.OutgoingItemID
        --------------------------------------
        LEFT JOIN SLE.RemittanceItem AS ri
            ON ri.RemittanceItemID = ro.RemittanceItemID
        --------------------------------------
        LEFT JOIN SLE.Invoice_OutGoing AS iog
            ON iog.OutgoingItemID = oi.OutgoingItemID
        --------------------------------------
        LEFT JOIN SLE.InvoiceItem AS ii
            ON ii.InvoiceItemID = iog.InvoiceItemID
        --------------------------------------
        LEFT JOIN SLE.Outgoing_Invoice AS oi2
            ON oi2.OutgoingItemId = oi.OutgoingItemID
        LEFT JOIN SLE.InvoiceItem AS ii2
            ON ii2.InvoiceItemID = oi2.InvoiceItemID
        --------------------------------------
        LEFT JOIN CTM.Order_Outgoing AS oo
            ON oo.OutgoingItemID = oi.OutgoingItemID
        LEFT JOIN CTM.OrderItem AS oi3
            ON oi3.OrderItemID = oo.OrderItemID
        --------------------------------------
      INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = j.StockID
      INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = j.FinancialPeriodID
      INNER JOIN cfg.vwPartyAccess AS vpa ON vpa.PartyID = prt.PartyID
    WHERE j.FinancialPeriodID = @FinancialPeriod
          AND sdt.DocumentType = 1
          AND j.Date
          BETWEEN @FromDate AND @EndDate
          AND
          (
              @Justifications IS NULL
              OR ji.JustificationID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Justifications)
                 )
          )
          AND
          (
              @Orders IS NULL
              OR oi3.OrderID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Orders)
                 )
          )
          AND
          (
              @Quotations IS NULL
              OR qi.QuotationID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Quotations)
                 )
          )
          AND
          (
              @Remittances IS NULL
              OR ri.RemittanceID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Remittances)
                 )
          )
          AND
          (
              @Invoices IS NULL
              OR ii.InvoiceID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Invoices)
                 )
              OR ii2.InvoiceID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Invoices)
                 )
          )
          AND
          (
              @Items IS NULL
              OR oi.OutgoingItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Outgoing'
                 )
              OR oi.InvoiceItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Invoice'
                 )
              OR oi.QuotationItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Quotation'
                 )
              OR oi.RemittanceItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Remittance'
                 )
          )
          AND @ReturnJustification IS NULL
          AND
          (
              @ReturnedSale IS NULL
              OR oi.OutgoingID IN
                 (
                     SELECT t.OutgoingID FROM #tt AS t
                 )
          );

END;

