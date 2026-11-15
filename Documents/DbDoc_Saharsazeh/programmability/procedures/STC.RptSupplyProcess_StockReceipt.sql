---------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].RptSupplyProcess_StockReceipt
    (
        @FinancialPeriod INT ,
        @FromDate DATE ,
        @EndDate DATE ,
        @StuffRequest VARCHAR(MAX) = NULL ,
        @PurchaseRequest VARCHAR(MAX) = NULL ,
        @Outgoing VARCHAR(MAX) = NULL ,
        @Proposal VARCHAR(MAX) = NULL ,
        @TemporaryStockReceipt VARCHAR(MAX) = NULL ,
        @JustificationInput VARCHAR(MAX) = NULL ,
        @PurchaseInvoice VARCHAR(MAX) = NULL ,
        @ReturnedTemporaryStockReceipt VARCHAR(MAX) = NULL ,
        @ReturnRequest VARCHAR(MAX) = NULL ,
        @PurchaseContract NVARCHAR(MAX) = NULL
    )
AS
BEGIN
    DECLARE @UserID INT ,
            @Culture VARCHAR(10) ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10),
			@CultureNo tinyint;


    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

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

    ---base document

    DECLARE @withoutBase NVARCHAR(100) ,
            @ProposalT NVARCHAR(100) ,
            @PurchaseRequestT NVARCHAR(100) ,
            @JustificationInputT NVARCHAR(100) ,
            @PurchaseInvoiceT NVARCHAR(100);

    SELECT @withoutBase = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'WithOutbase'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @ProposalT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'Proposal'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @PurchaseRequestT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'PurchaseRequest'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @JustificationInputT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'JustificationInput'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @PurchaseInvoiceT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'PurchaseInvoice'
           AND LV.Culture = CFG.GetuserCulture();

    -----------------------


    SELECT sr.StockReceiptID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StockTitle,
           s.Code AS StockCode ,
           sdt.DocumentType ,
		   case when @CultureNo = 1 then sdt.Title
	            when @CultureNo = 2 then sdt.Title2
	       end as TypeString,
           CASE sdtb.BaseEntity
                WHEN 1 THEN @withoutBase
                WHEN 2 THEN @PurchaseRequestT
                WHEN 3 THEN @ProposalT
                WHEN 6 THEN @JustificationInputT
                WHEN 7 THEN @PurchaseInvoiceT
           END AS BaseDocumentString
    FROM   STC.StockReceipt AS sr
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
           INNER JOIN STC.StockDocumentType AS sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
           LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
           INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = s.StockID
    WHERE  @ReturnedTemporaryStockReceipt IS NULL
           AND @Outgoing IS NULL
           AND @PurchaseContract IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.StockReceiptID IN (   SELECT main.StockReceiptID
                                        FROM   STC.StockReceiptItem AS main

                                               --------------

                                               LEFT JOIN REQ.StuffRequest_StockReceipt AS vw1 ON vw1.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                               --------------

                                               LEFT JOIN REQ.PurchaseRequest_StockReceipt AS vw2 ON vw2.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                               --------------

                                               LEFT JOIN STC.JustificationInput_StockReceipt AS vw3 ON vw3.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN STC.JustificationInputItem AS jii ON jii.JustificationInputItemID = vw3.JustificationInputItemID

                                               --------------

                                               LEFT JOIN STC.StockReceipt_PurchaseInvoice AS vw4 ON vw4.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseInvoiceItemID = vw4.StockReceiptItemID

                                               --------------

                                               LEFT JOIN STC.StockReceipt_ReturnRequest AS vw5 ON vw5.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN REQ.ReturnRequestItem AS rri ON rri.ReturnRequestItemID = vw5.ReturnRequestItemID

                                               --------------

                                               LEFT JOIN STC.TemporaryStockReceipt_StockReceipt AS vw6 ON vw6.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.TemporaryStockReceiptItemID = vw6.TemporaryStockReceiptItemID

                                               --------------

                                               LEFT JOIN VND.Proposal_StockReceipt AS vw7 ON vw7.StockReceiptItemID = main.StockReceiptItemID
                                               LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw7.ProposalItemID
                                        WHERE  (   @StuffRequest IS NULL
                                                   OR sri.StuffRequestID IN (   SELECT value
                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                           @StuffRequest) ))
                                               AND (   @PurchaseRequest IS NULL
                                                       OR pri.PurchaseRequestID IN (   SELECT value
                                                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                                                  @PurchaseRequest) ))
                                               AND (   @PurchaseInvoice IS NULL
                                                       OR pii.PurchaseInvoiceID IN (   SELECT value
                                                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                                                  @PurchaseInvoice) ))
                                               AND (   @Proposal IS NULL
                                                       OR pi1.ProposalID IN (   SELECT value
                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                           @Proposal) ))
                                               AND (   @ReturnRequest IS NULL
                                                       OR rri.ReturnRequestID IN (   SELECT value
                                                                                     FROM   CFG.R_FnCommaStr2Table(
                                                                                                @ReturnRequest) ))
                                               AND (   @TemporaryStockReceipt IS NULL
                                                       OR tsri.TemporaryStockReceiptID IN (   SELECT value
                                                                                              FROM   CFG.R_FnCommaStr2Table(
                                                                                                         @TemporaryStockReceipt) ))
                                               AND (   @JustificationInput IS NULL
                                                       OR jii.JustificationInputID IN (   SELECT value
                                                                                          FROM   CFG.R_FnCommaStr2Table(
                                                                                                     @JustificationInput) )));
END;
