----------------------------end of GetPurchaseProcessEntityRelation---------------------------------------------------------
CREATE   PROCEDURE [STC].RptSupplyProcess_TemporaryStockReceipt
    (
        @FinancialPeriod INT ,
        @FromDate DATE ,
        @EndDate DATE ,
        @StuffRequest VARCHAR(MAX) = NULL ,
        @PurchaseRequest VARCHAR(MAX) = NULL ,
        @Outgoing VARCHAR(MAX) = NULL ,
        @Proposal VARCHAR(MAX) = NULL ,
        @JustificationInput VARCHAR(MAX) = NULL ,
        @StockReceipt VARCHAR(MAX) = NULL ,
        @PurchaseInvoice VARCHAR(MAX) = NULL ,
        @ReturnedTemporaryStockReceipt VARCHAR(MAX) = NULL ,
        @ReturnRequest VARCHAR(MAX) = NULL ,
        @PurchaseContract NVARCHAR(MAX) = NULL
    )
AS
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

    -----------------
    DECLARE @PurchaseRequestT NVARCHAR(100) ,
            @ProposalT NVARCHAR(100) ,
            @WithoutBase NVARCHAR(100);


    SELECT @WithoutBase = LV.Value
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
    -----------------
    SELECT sr.TemporaryStockReceiptID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StockTitle,
           s.Code AS StockCode ,
           CASE sdtb.BaseEntity
                WHEN 1 THEN @WithoutBase
                WHEN 2 THEN @PurchaseRequestT
                WHEN 3 THEN @ProposalT
           END BaseDocumentString ,
		   case when @CultureNo = 1 then sdt.Title
	            when @CultureNo = 2 then sdt.Title2
	       end as DocumentType

    FROM   STC.TemporaryStockReceipt AS sr
           JOIN STC.StockDocumentTypeBaseEntity sdtb
                        ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
           INNER JOIN STC.StockDocumentType AS sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
           LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
           INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = s.StockID
    WHERE  @PurchaseRequest IS NULL
           AND @Outgoing IS NULL
           AND @PurchaseContract IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.TemporaryStockReceiptID IN (   SELECT main.TemporaryStockReceiptID
                                                 FROM   STC.TemporaryStockReceiptItem AS main

                                                        --------------

                                                        LEFT JOIN REQ.StuffRequest_TemporaryStockReceipt AS vw1 ON vw1.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                                        --------------

                                                        LEFT JOIN REQ.PurchaseRequest_TemporaryStockReceipt AS vw2 ON vw2.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                                        --------------

                                                        LEFT JOIN VND.Proposal_TemporaryStockReceipt AS vw3 ON vw3.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw3.ProposalItemID

                                                        --------------

                                                        LEFT JOIN STC.TemporaryStockReceipt_PurchaseInvoice AS vw4 ON vw4.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseInvoiceItemID = vw4.PurchaseInvoiceItemID

                                                        --------------

                                                        LEFT JOIN STC.TemporaryStockReceipt_JustificationInput AS vw5 ON vw5.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN STC.JustificationInputItem AS jii ON jii.JustificationInputItemID = vw5.JustificationInputItemID

                                                        --------------

                                                        LEFT JOIN STC.TemporaryStockReceipt_ReturnedTemporaryStockReceipt AS vw6 ON vw6.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnedTemporaryStockReceiptItemID = vw6.ReturnedTemporaryStockReceiptItemID

                                                        --------------

                                                        LEFT JOIN STC.TemporaryStockReceipt_ReturnRequest AS vw7 ON vw7.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN REQ.ReturnRequestItem AS rri ON rri.ReturnRequestItemID = vw7.ReturnRequestItemID
                                                        --------------

                                                        LEFT JOIN STC.TemporaryStockReceipt_StockReceipt AS vw8 ON vw8.TemporaryStockReceiptItemID = main.TemporaryStockReceiptItemID
                                                        LEFT JOIN STC.StockReceiptItem AS sri2 ON sri2.StockReceiptItemID = vw8.StockReceiptItemID
                                                 WHERE  (   @StuffRequest IS NULL
                                                            OR sri.StuffRequestID IN (   SELECT value
                                                                                         FROM   CFG.R_FnCommaStr2Table(
                                                                                                    @StuffRequest) ))
                                                        AND (   @PurchaseRequest IS NULL
                                                                OR pri.PurchaseRequestID IN (   SELECT value
                                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                                           @PurchaseRequest) ))
                                                        AND (   @StockReceipt IS NULL
                                                                OR sri2.StockReceiptID IN (   SELECT value
                                                                                              FROM   CFG.R_FnCommaStr2Table(
                                                                                                         @StockReceipt) ))
                                                        AND (   @PurchaseInvoice IS NULL
                                                                OR pii.PurchaseInvoiceID IN (   SELECT value
                                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                                           @PurchaseInvoice) ))
                                                        AND (   @Proposal IS NULL
                                                                OR pi1.ProposalID IN (   SELECT value
                                                                                         FROM   CFG.R_FnCommaStr2Table(
                                                                                                    @Proposal) ))
                                                        AND (   @JustificationInput IS NULL
                                                                OR jii.JustificationInputID IN (   SELECT value
                                                                                                   FROM   CFG.R_FnCommaStr2Table(
                                                                                                              @JustificationInput) ))
                                                        AND (   @ReturnRequest IS NULL
                                                                OR rri.ReturnRequestID IN (   SELECT value
                                                                                              FROM   CFG.R_FnCommaStr2Table(
                                                                                                         @ReturnRequest) ))
                                                        AND (   @ReturnedTemporaryStockReceipt IS NULL
                                                                OR rtsri.ReturnedTemporaryStockReceiptID IN (   SELECT value
                                                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                                                           @ReturnedTemporaryStockReceipt) )));
