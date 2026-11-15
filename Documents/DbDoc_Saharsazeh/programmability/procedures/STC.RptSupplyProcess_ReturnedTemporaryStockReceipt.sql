
--------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].RptSupplyProcess_ReturnedTemporaryStockReceipt
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
        @JustificationINput VARCHAR(MAX) = NULL ,
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


    ---
    DECLARE @TempReceipt NVARCHAR(100) ,
            @ReturnRequestT NVARCHAR(100) ,
            @WithoutBase NVARCHAR(100);

    SELECT @WithoutBase = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'WithOutbase'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @TempReceipt = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'TemporaryReceipt'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @ReturnRequestT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
           AND L.Item = 'ReturnRequest'
           AND LV.Culture = CFG.GetuserCulture();

    ---------

    SELECT sr.ReturnedTemporaryStockReceiptID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StockTitle,
           s.Code AS StockCode ,
           CASE sdtb.BaseEntity
                WHEN 1 THEN @WithoutBase
                WHEN 4 THEN @TempReceipt
                WHEN 5 THEN @ReturnRequestT
           END BaseDocumentString ,
		   case when @CultureNo = 1 then sdt.Title
	            when @CultureNo = 2 then sdt.Title2
	       end as DocumentType

    FROM   STC.ReturnedTemporaryStockReceipt AS sr
	       JOIN STC.StockDocumentTypeBaseEntity sdtb
               ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
           INNER JOIN STC.StockDocumentType AS sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
           LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
           INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = s.StockID
    WHERE  @Outgoing IS NULL
           AND @StockReceipt IS NULL
           AND @PurchaseContract IS NULL
           AND @PurchaseInvoice IS NULL
           AND @JustificationINput IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.ReturnedTemporaryStockReceiptID IN (   SELECT main.ReturnedTemporaryStockReceiptID
                                                         FROM   STC.ReturnedTemporaryStockReceiptItem AS main

                                                                --------------

                                                                LEFT JOIN REQ.StuffRequest_ReturnedTemporaryStockReceipt AS vw1 ON vw1.ReturnedTemporaryStockReceiptItemID = main.ReturnedTemporaryStockReceiptItemID
                                                                LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                                                --------------

                                                                LEFT JOIN REQ.PurchaseRequest_ReturnedTemporaryStockReceipt AS vw2 ON vw2.ReturnedTemporaryStockReceiptItemID = main.ReturnedTemporaryStockReceiptItemID
                                                                LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                                                --------------

                                                                LEFT JOIN REQ.ReturnRequest_ReturnedTemporaryStockReceipt AS vw3 ON vw3.ReturnedTemporaryStockReceiptItemID = main.ReturnedTemporaryStockReceiptItemID
                                                                LEFT JOIN REQ.ReturnRequestItem AS rii ON rii.ReturnRequestItemID = vw3.ReturnRequestItemID

                                                                --------------

                                                                LEFT JOIN STC.TemporaryStockReceipt_ReturnedTemporaryStockReceipt AS vw4 ON vw4.ReturnedTemporaryStockReceiptItemID = main.ReturnedTemporaryStockReceiptItemID
                                                                LEFT JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.TemporaryStockReceiptItemID = vw4.TemporaryStockReceiptItemID

                                                                --------------

                                                                LEFT JOIN VND.Proposal_ReturnedTemporaryStockReceipt AS vw5 ON vw5.ReturnedTemporaryStockReceiptItemID = main.ReturnedTemporaryStockReceiptItemID
                                                                LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw5.ProposalItemID
                                                         WHERE  (   @StuffRequest IS NULL
                                                                    OR sri.StuffRequestID IN (   SELECT value
                                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                                            @StuffRequest) ))
                                                                AND (   @PurchaseRequest IS NULL
                                                                        OR pri.PurchaseRequestID IN (   SELECT value
                                                                                                        FROM   CFG.R_FnCommaStr2Table(
                                                                                                                   @PurchaseRequest) ))
                                                                AND (   @ReturnRequest IS NULL
                                                                        OR rii.ReturnRequestID IN (   SELECT value
                                                                                                      FROM   CFG.R_FnCommaStr2Table(
                                                                                                                 @ReturnRequest) ))
                                                                AND (   @TemporaryStockReceipt IS NULL
                                                                        OR tsri.TemporaryStockReceiptID IN (   SELECT value
                                                                                                               FROM   CFG.R_FnCommaStr2Table(
                                                                                                                          @TemporaryStockReceipt) ))
                                                                AND (   @Proposal IS NULL
                                                                        OR pi1.ProposalID IN (   SELECT value
                                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                                            @Proposal) )));


