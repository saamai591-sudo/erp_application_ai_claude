
---------------------------------------------------------
CREATE    PROC [SLE].RptSale_Invoice
(
    @FinancialPeriod INT,
    @FromDate DATE,
    @EndDate DATE,
    -------------------------------------
    @Justifications VARCHAR(MAX) = NULL,
    @Quotations VARCHAR(MAX) = NULL,
    @Remittances VARCHAR(MAX) = NULL,
    @Return VARCHAR(MAX) = NULL,
    @Outgoings VARCHAR(MAX) = NULL,
    @Items VARCHAR(MAX) = NULL,
    @Orders VARCHAR(MAX) = NULL,
    @ReturnJustification VARCHAR(MAX) = NULL
-------------------------------------
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @WithOutbase NVARCHAR(100),
            @Remittance NVARCHAR(100),
            @Justification NVARCHAR(100),
            @Quotation NVARCHAR(100),
            @Outgoing NVARCHAR(100),
            @Submit NVARCHAR(100),
            @Revoke NVARCHAR(100),
            @Confirmed NVARCHAR(100),
            @Voucher NVARCHAR(100),
            @PreVoucher NVARCHAR(100),
            @Reception NVARCHAR(100),
            @Contract NVARCHAR(100),
            @ContractStatement NVARCHAR(100),
            @SaleAsset NVARCHAR(100),
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

    SELECT @SaleAsset = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'SaleAsset'
          AND lev.Culture = @Culture;

    SELECT @ContractStatement = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'ContractStatement'
          AND lev.Culture = @Culture;

    SELECT @Contract = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Contract'
          AND lev.Culture = @Culture;

    SELECT @Reception = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Reception'
          AND lev.Culture = @Culture;

    SELECT @Voucher = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'AccountingDocument'
          AND lev.Culture = @Culture;

    SELECT @PreVoucher = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'DocumentNumTypes'
          AND le.Item = 'PreVoucher'
          AND lev.Culture = @Culture;


    SELECT @Submit = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'Statuses'
          AND le.Item = 'Submit'
          AND lev.Culture = @Culture;

    SELECT @Revoke = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'Statuses'
          AND le.Item = 'Revoke'
          AND lev.Culture = @Culture;

    SELECT @Confirmed = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'Statuses'
          AND le.Item = 'Confirmed'
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

    SELECT @Outgoing = lev.[Value]
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Outgoing'
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

    SELECT VoucherID,
           PrevoucherID
    INTO #vp
    FROM ACC.VoucherPrevoucher
    GROUP BY VoucherID,
             PrevoucherID;


    SELECT CFG.GetStringPartBySpliter(value, 1, '#') DocType,
           CFG.GetStringPartBySpliter(value, 2, '#') DocID
    INTO #Items
    FROM CFG.Split(@Items, '|');



    SELECT DISTINCT
           j.InvoiceID,
           CASE
               WHEN BaseDocument = 1 THEN
                   @WithOutbase
               WHEN BaseDocument = 3 THEN
                   @Justification
               WHEN BaseDocument = 4 THEN
                   @Quotation
               WHEN BaseDocument = 5 THEN
                   @Remittance
               WHEN BaseDocument = 9 THEN
                   @Outgoing
               WHEN BaseDocument = 10 THEN
                   @Reception
               WHEN BaseDocument = 11 THEN
                   @Contract
               WHEN BaseDocument = 12 THEN
                   @ContractStatement
               WHEN BaseDocument = 13 THEN
                   @SaleAsset
           END AS BaseDocument,
           CASE
               WHEN @CultureNo = 1 THEN
                   st.Title
               WHEN @CultureNo = 2 THEN
                   st.Title2
           END AS [Type],
           b.Code AS BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               WHEN @CultureNo = 2 THEN
                   b.Title2
           END AS BranchTitle,
           p.Title + ' ' + ISNULL(p.LastName, '') AS PartyTitle,
           p.Title2 + ' ' + ISNULL(p.LastName2, '') AS PartyTitle2,
           d.Code AS PartyCode,
           Number,
           [Date],
           CFG.GetCLRSaturnDate([Date], @DateFormat, 0, @DateType) AS [Date_Date],
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               WHEN @CultureNo = 2 THEN
                   c.Title2
           END AS CurrencyTitle,
           j.CurrencyRate,
           j.TotalPrice,
           j.TotalDiscount,
           j.TotalNetPrice,
           CASE
               WHEN #vp.VoucherID IS NOT NULL THEN
                   @Voucher
               WHEN #vp.PrevoucherID IS NOT NULL THEN
                   @PreVoucher
               WHEN SaleInvoiceStatus = 1 THEN
                   @Submit
               WHEN SaleInvoiceStatus = 2 THEN
                   @Confirmed
               WHEN SaleInvoiceStatus = 5 THEN
                   @Revoke
           END AS [Status],
           CASE WHEN j.SaleInvoiceStatus = 5 THEN 0 ELSE inr.NonReceived END AS Non_Received
    FROM SLE.Invoice AS j
        JOIN SLE.SaleType AS st
            ON st.SaleTypeID = j.SaleTypeID
        JOIN SLE.InvoiceItem I
            ON I.InvoiceID = j.InvoiceID
        JOIN CFG.Currency c
            ON c.CurrencyID = j.CurrencyID
        JOIN CFG.Branch b
            ON b.BranchID = j.BranchID
        JOIN CFG.Party p
            ON j.CustomerID = p.PartyID
        LEFT JOIN SLE.Invoice_NonReceived AS inr
            ON inr.InvoiceID = j.InvoiceID
        LEFT JOIN ACC.DL d
            ON d.DLID = p.DlID
        LEFT JOIN #vp
            ON #vp.PrevoucherID = j.PreVoucherID
        -------------------
        LEFT JOIN CTM.Order_Invoice AS oi4
            ON oi4.InvoiceItemID = I.InvoiceItemID
        --------------------
        LEFT JOIN SLE.ReturnedSaleJustificationItem AS rsji
            ON rsji.InvoiceItemID = I.InvoiceItemID
        ----------------------
        LEFT JOIN
        (
            SELECT rsii.ReturnedSaleInvoiceItemID,
                   rsii.InvoiceItemID
            FROM SLE.ReturnedSaleInvoiceItem AS rsii
            WHERE rsii.ReturnedSaleJustificationItemID IS NULL
            UNION
            SELECT rsii2.ReturnedSaleInvoiceItemID,
                   rsii2.InvoiceItemID
            FROM SLE.ReturnedSaleJustificationItem AS rsji2
                JOIN SLE.ReturnedSaleInvoiceItem AS rsii2
                    ON rsii2.ReturnedSaleJustificationItemID = rsji2.ReturnedSaleJustificationItemID
        ) rsji2
            ON rsji2.InvoiceItemID = I.InvoiceItemID


        -------------
        LEFT JOIN SLE.Justification_Invoice AS ji
            ON ji.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN SLE.JustificationItem AS ji2
            ON ji2.JustificationItemID = ji.JustificationItemID

        -------------
        LEFT JOIN SLE.Quotation_Invoice AS qi
            ON qi.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN SLE.QuotationItem AS qi2
            ON qi2.QuotationItemID = qi.QuotationItemID

        -------------
        LEFT JOIN SLE.Invoice_Remittance AS ir
            ON ir.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN SLE.RemittanceItem AS ri
            ON ri.RemittanceItemID = ir.RemittanceItemID
        -------------
        LEFT JOIN SLE.Remittance_Invoice AS ri2
            ON ri2.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN SLE.RemittanceItem AS ri3
            ON ri3.RemittanceItemID = ri2.RemittanceItemID
        -------------
        LEFT JOIN SLE.Invoice_OutGoing AS iog
            ON iog.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN STC.OutgoingItem AS oi
            ON oi.OutgoingItemID = iog.OutgoingItemID
        -------------
        LEFT JOIN SLE.Outgoing_Invoice AS oi2
            ON oi2.InvoiceItemID = I.InvoiceItemID
        LEFT JOIN STC.OutgoingItem AS oi3
            ON oi3.OutgoingItemID = oi2.OutgoingItemId
          
        INNER JOIN cfg.vwSaleAreaAccess AS vsaa ON vsaa.SaleAreaID = j.SaleAreaID
        INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = j.FinancialPeriodID  
        INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = j.BranchID
        INNER JOIN cfg.vwPartyAccess AS vpa ON j.CustomerID=vpa.PartyID
    -------------
    WHERE j.FinancialPeriodID = @FinancialPeriod
          AND j.Date
          BETWEEN @FromDate AND @EndDate


          AND
          (
              @Justifications IS NULL
              OR ji2.JustificationID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Justifications)
                 )
          )
          AND
          (
              @Orders IS NULL
              OR oi4.OrderItemID IN
                 (
                     SELECT oi2.OrderItemID
                     FROM CTM.OrderItem AS oi2
                         JOIN CFG.R_FnCommaStr2Table(@Orders) fl
                             ON oi2.OrderID = fl.value
                 )
          )
          AND
          (
              @ReturnJustification IS NULL
              OR rsji.ReturnedSaleJustificationItemID IN
                 (
                     SELECT rsji3.ReturnedSaleJustificationItemID
                     FROM SLE.ReturnedSaleJustificationItem AS rsji3
                         JOIN CFG.R_FnCommaStr2Table(@ReturnJustification) h
                             ON h.value = rsji3.ReturnedSaleJustificationID
                 )
          )
          AND
          (
              @Quotations IS NULL
              OR qi2.QuotationID IN
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
              OR ri3.RemittanceID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Remittances)
                 )
          )
          AND
          (
              @Return IS NULL
              OR rsji2.ReturnedSaleInvoiceItemID IN
                 (
                     SELECT rsii3.ReturnedSaleInvoiceItemID
                     FROM SLE.ReturnedSaleInvoiceItem AS rsii3
                         JOIN CFG.R_FnCommaStr2Table(@Return) H
                             ON H.value = rsii3.ReturnedSaleInvoiceID
                 )
          )
          AND
          (
              @Outgoings IS NULL
              OR oi.OutgoingID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Outgoings)
                 )
              OR oi3.OutgoingID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@Outgoings)
                 )
          )
          AND
          (
              @Items IS NULL
              OR I.OutgoingItemId IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Outgoing'
                 )
              OR I.InvoiceItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Invoice'
                 )
              OR I.QuotationItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Quotation'
                 )
              OR I.RemittanceItemID IN
                 (
                     SELECT DocID FROM #Items WHERE DocType = 'Remittance'
                 )
          )
     ;
END;
