CREATE    PROCEDURE [VND].[RptSupplyProcess_PurchaseInvoice]
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
        @JustificationInput VARCHAR(MAX) = NULL ,
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

    -------------------
    DECLARE @WithOutbase NVARCHAR(100) ,
            @PurchaseRequestT NVARCHAR(100) ,
            @Contract NVARCHAR(100) ,
            @ContractStatement NVARCHAR(100) ,
            @ProposalT NVARCHAR(100) ,
            @StockReceiptT NVARCHAR(100);

    SELECT @WithOutbase = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'WithOutbase'
           AND LV.Culture = @Culture;

    SELECT @PurchaseRequestT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'PurchaseRequest'
           AND LV.Culture = @Culture;

    SELECT @Contract = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'Contract'
           AND LV.Culture = @Culture;

    SELECT @ContractStatement = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'ContractStatement'
           AND LV.Culture = @Culture;

    SELECT @ProposalT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'Proposal'
           AND LV.Culture = @Culture;

    SELECT @StockReceiptT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'StockReceipt'
           AND LV.Culture = @Culture;

    -----------------------
    SELECT sr.PurchaseInvoiceID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then b.Title
	                when @CultureNo = 2 then b.Title2
	           end as BranchTitle,
           b.Code AS BranchCode ,
           CAST(CASE sr.BaseType
                     WHEN 1 THEN @WithOutbase
                     WHEN 2 THEN @PurchaseRequest
                     WHEN 3 THEN @Contract
                     WHEN 4 THEN @ContractStatement
                     WHEN 5 THEN @ProposalT
                     WHEN 6 THEN @StockReceiptT
                END AS NVARCHAR(512)) AS BaseTypeString ,
				case when @CultureNo = 1 then pt.Title
	                when @CultureNo = 2 then pt.Title2
	           end as TypeString

    FROM   VND.PurchaseInvoice AS sr
           JOIN VND.PurchaseType AS pt ON pt.PurchaseTypeID = sr.[Type]
           LEFT JOIN CFG.Branch AS b ON b.BranchID = sr.BranchID
           INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID  = b.BranchID
    WHERE  @ReturnedTemporaryStockReceipt IS NULL
           AND @ReturnRequest IS NULL
           AND @Outgoing IS NULL
           AND @PurchaseContract IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.PurchaseInvoiceID IN (   SELECT main.PurchaseInvoiceID
                                           FROM   VND.PurchaseInvoiceItem AS main

                                                  --------------

                                                  LEFT JOIN REQ.StuffRequest_PurchaseInvoice AS vw1 ON vw1.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                                  --------------

                                                  LEFT JOIN REQ.PurchaseRequest_PurchaseInvoice AS vw2 ON vw2.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                                  --------------

                                                  LEFT JOIN STC.JustificationInput_PurchaseInvoice AS vw3 ON vw3.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN STC.JustificationInputItem AS jii ON jii.JustificationInputItemID = vw3.JustificationInputItemID

                                                  --------------

                                                  LEFT JOIN STC.StockReceipt_PurchaseInvoice AS vw4 ON vw4.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN STC.StockReceiptItem AS sri2 ON sri2.StockReceiptItemID = vw4.StockReceiptItemID

                                                  --------------

                                                  LEFT JOIN STC.TemporaryStockReceipt_PurchaseInvoice AS vw5 ON vw5.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.TemporaryStockReceiptItemID = vw5.TemporaryStockReceiptItemID

                                                  --------------

                                                  LEFT JOIN VND.Proposal_PurchaseInvoice AS vw6 ON vw6.PurchaseInvoiceItemID = main.PurchaseInvoiceItemID
                                                  LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw6.ProposalItemID
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
                                                  AND (   @Proposal IS NULL
                                                          OR pi1.ProposalID IN (   SELECT value
                                                                                   FROM   CFG.R_FnCommaStr2Table(
                                                                                              @Proposal) ))
                                                  AND (   @TemporaryStockReceipt IS NULL
                                                          OR tsri.TemporaryStockReceiptID IN (   SELECT value
                                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                                            @TemporaryStockReceipt) ))
                                                  AND (   @JustificationInput IS NULL
                                                          OR jii.JustificationInputID IN (   SELECT value
                                                                                             FROM   CFG.R_FnCommaStr2Table(
                                                                                                        @JustificationInput) )));

