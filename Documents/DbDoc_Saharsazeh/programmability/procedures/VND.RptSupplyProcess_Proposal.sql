CREATE    PROCEDURE [VND].[RptSupplyProcess_Proposal]
    (
        @FinancialPeriod INT ,
        @FromDate DATE ,
        @EndDate DATE ,
        @StuffRequest VARCHAR(MAX) = NULL ,
        @PurchaseRequest VARCHAR(MAX) = NULL ,
        @Outgoing VARCHAR(MAX) = NULL ,
        @justificationInput VARCHAR(MAX) = NULL ,
        @TemporaryStockReceipt VARCHAR(MAX) = NULL ,
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

    DECLARE @Internal NVARCHAR(100) ,
            @Importable NVARCHAR(100) ,
            @WithOutbase NVARCHAR(100) ,
            @PurchaseRequestT NVARCHAR(100);

    SELECT @Internal = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TradeType'
           AND L.Item = 'Internal'
           AND LV.Culture = @Culture;

    SELECT @Importable = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TradeType'
           AND L.Item = 'Import'
           AND LV.Culture = @Culture;


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


    SELECT sr.ProposalID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then b.Title
	            when @CultureNo = 2 then b.Title2
	       end as BranchTitle,
           b.Code AS BranchCode ,
           CASE sr.BaseDocument
                WHEN 1 THEN @WithOutbase
                WHEN 2 THEN @PurchaseRequestT
           END BaseDocumentString ,
           CAST(CASE sr.[Type]
                     WHEN 1 THEN @Importable
                     ELSE @Internal
                END AS NVARCHAR(512)) AS TypeString
    FROM   VND.Proposal AS sr
           LEFT JOIN CFG.Branch AS b ON b.BranchID = sr.BranchID
          INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = b.BranchID
    WHERE  @Outgoing IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.ProposalID IN (   SELECT main.ProposalID
                                    FROM   VND.ProposalItem AS main --------------
                                           LEFT JOIN REQ.StuffRequest_Proposal AS vw1 ON vw1.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                           --------------
                                           LEFT JOIN REQ.PurchaseRequest_Proposal AS vw2 ON vw2.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_StockReceipt AS vw3 ON vw3.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN STC.StockReceiptItem AS sri2 ON sri2.StockReceiptItemID = vw3.StockReceiptItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_PurchaseInvoice AS vw4 ON vw4.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseInvoiceItemID = vw4.PurchaseInvoiceItemID


                                           --------------
                                           LEFT JOIN VND.Proposal_JustificationInput AS vw5 ON vw5.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN STC.JustificationInputItem AS jii ON jii.JustificationInputItemID = vw5.JustificationInputItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_ReturnedTemporaryStockReceipt AS vw6 ON vw6.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri ON rtsri.ReturnedTemporaryStockReceiptItemID = vw6.ReturnedTemporaryStockReceiptItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_ReturnRequest AS vw7 ON vw7.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN REQ.ReturnRequestItem AS rri ON rri.ReturnRequestItemID = vw7.ReturnRequestItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_TemporaryStockReceipt AS vw8 ON vw8.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN STC.TemporaryStockReceiptItem AS tsri ON tsri.TemporaryStockReceiptItemID = vw8.TemporaryStockReceiptItemID

                                           --------------
                                           LEFT JOIN VND.Proposal_PurchaseContract AS vw9 ON vw9.ProposalItemID = main.ProposalItemID
                                           LEFT JOIN VND.PurchaseContractItem AS pci ON tsri.PurchaseContractItemID = vw9.PurchaseContractItemID
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
                                           AND (   @justificationInput IS NULL
                                                   OR jii.JustificationInputID IN (   SELECT value
                                                                                      FROM   CFG.R_FnCommaStr2Table(
                                                                                                 @justificationInput) ))
                                           AND (   @ReturnRequest IS NULL
                                                   OR rri.ReturnRequestID IN (   SELECT value
                                                                                 FROM   CFG.R_FnCommaStr2Table(
                                                                                            @ReturnRequest) ))
                                           AND (   @TemporaryStockReceipt IS NULL
                                                   OR tsri.TemporaryStockReceiptID IN (   SELECT value
                                                                                          FROM   CFG.R_FnCommaStr2Table(
                                                                                                     @TemporaryStockReceipt) ))
                                           AND (   @ReturnedTemporaryStockReceipt IS NULL
                                                   OR rtsri.ReturnedTemporaryStockReceiptID IN (   SELECT value
                                                                                                   FROM   CFG.R_FnCommaStr2Table(
                                                                                                              @ReturnedTemporaryStockReceipt) ))
                                           AND (   @PurchaseContract IS NULL
                                                   OR pci.PurchaseContractID IN (   SELECT value
                                                                                    FROM   CFG.R_FnCommaStr2Table(
                                                                                               @PurchaseContract) )));


