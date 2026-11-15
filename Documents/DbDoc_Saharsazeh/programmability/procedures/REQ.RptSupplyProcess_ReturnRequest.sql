CREATE    PROCEDURE [REQ].[RptSupplyProcess_ReturnRequest]
    (
        @FinancialPeriod INT ,
        @FromDate DATE ,
        @EndDate DATE ,
        @StuffRequest VARCHAR(MAX) = NULL ,
        @PurchaseRequest VARCHAR(MAX) = NULL ,
        @Outgoing VARCHAR(MAX) = NULL ,
        @Proposal VARCHAR(MAX) = NULL ,
        @TemporaryStockReceipt VARCHAR(MAX) = NULL ,
        @StockReceipt VARCHAR(MAX) = NULL ,
        @PurchaseInvoice VARCHAR(MAX) = NULL ,
        @ReturnedTemporaryStockReceipt VARCHAR(MAX) = NULL ,
        @JustificationInput VARCHAR(MAX) = NULL ,
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

    ----------------
    DECLARE @WithOutbase NVARCHAR(100) ,
            @StockReceiptT NVARCHAR(100) ,
            @TemporaryStockReceiptT NVARCHAR(100);

    SELECT @WithOutbase = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'RequestDocumentBase'
           AND L.Item = 'WithOutbase'
           AND LV.Culture = @Culture;

    SELECT @StockReceiptT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'RequestDocumentBase'
           AND L.Item = 'StockReceipt'
           AND LV.Culture = @Culture;

    SELECT @TemporaryStockReceiptT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'RequestDocumentBase'
           AND L.Item = 'TemporaryStockReceipt'
           AND LV.Culture = @Culture;

    -----------------
    SELECT sr.ReturnRequestID ,
           sr.ReturnRequestNumber ,
               sr.ReturnRequestDate,
           CFG.GetCLRSaturnDate(
               sr.ReturnRequestDate, @DateFormat, 0, @DateType) AS Date_ReturnRequestDate ,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StockTitle,
           s.Code AS StockCode ,
           CASE sr.DocumentType
                WHEN 1 THEN @WithOutbase
                WHEN 3 THEN @StockReceiptT
                WHEN 4 THEN @TemporaryStockReceiptT
           END DocumentTypeString
    FROM   REQ.ReturnRequest AS sr
           LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
          INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID  = s.StockID
    WHERE  @Outgoing IS NULL
           AND @PurchaseInvoice IS NULL
           AND @JustificationInput IS NULL
           AND @PurchaseContract IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.ReturnRequestDate >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.ReturnRequestDate <= @EndDate )
           AND sr.ReturnRequestID IN (   SELECT main.ReturnRequestID
                                         FROM   REQ.ReturnRequestItem AS main

                                                --------------

                                                LEFT JOIN REQ.StuffRequest_ReturnRequest AS vw1 ON vw1.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                                --------------

                                                LEFT JOIN REQ.PurchaseRequest_ReturnRequest AS vw2 ON vw2.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                                --------------

                                                LEFT JOIN REQ.ReturnRequest_ReturnedTemporaryStockReceipt AS vw3 ON vw3.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsr ON rtsr.ReturnedTemporaryStockReceiptItemID = vw3.ReturnedTemporaryStockReceiptItemID

                                                --------------

                                                LEFT JOIN STC.StockReceipt_ReturnRequest AS vw4 ON vw4.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN STC.StockReceiptItem AS sri2 ON sri2.StockReceiptItemID = vw4.StockReceiptItemID

												--------------

                                                LEFT JOIN STC.TemporaryStockReceipt_ReturnRequest AS vw5 ON vw5.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.TemporaryStockReceiptItemID = vw5.TemporaryStockReceiptItemID

                                                --------------

                                                LEFT JOIN VND.Proposal_ReturnRequest AS vw6 ON vw6.ReturnRequestItemID = main.ReturnRequestItemID
                                                LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw6.ProposalItemID
                                         WHERE  (   @StuffRequest IS NULL
                                                    OR sri.StuffRequestID IN (   SELECT value
                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                            @StuffRequest) ))
                                                AND (   @StockReceipt IS NULL
                                                        OR sri2.StockReceiptID IN (   SELECT value
                                                                                      FROM   CFG.R_FnCommaStr2Table(
                                                                                                 @StockReceipt) ))
                                                AND (   @PurchaseRequest IS NULL
                                                        OR pri.PurchaseRequestID IN (   SELECT value
                                                                                        FROM   CFG.R_FnCommaStr2Table(
                                                                                                   @PurchaseRequest) ))
                                                AND (   @Proposal IS NULL
                                                        OR pi1.ProposalID IN (   SELECT value
                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                            @Proposal) ))
                                                AND (   @TemporaryStockReceipt IS NULL
                                                        OR tsri.TemporaryStockReceiptID IN (   SELECT value
                                                                                               FROM   CFG.R_FnCommaStr2Table(
                                                                                                          @TemporaryStockReceipt) ))
                                                AND (   @ReturnedTemporaryStockReceipt IS NULL
                                                        OR rtsr.ReturnedTemporaryStockReceiptID IN (   SELECT value
                                                                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                                                                  @ReturnedTemporaryStockReceipt) )));

