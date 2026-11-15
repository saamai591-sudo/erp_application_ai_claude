CREATE    PROCEDURE [VND].[RptSupplyProcess_PurchaseContract]
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
        @PurchaseInvoice NVARCHAR(MAX) = NULL
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
            @ProposalT NVARCHAR(100);

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

    SELECT @ProposalT = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PurchaseDocumentBases'
           AND L.Item = 'Proposal'
           AND LV.Culture = @Culture;

    -----------------------
    SELECT sr.PurchaseContractID ,
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
                     WHEN 5 THEN @ProposalT
                     WHEN 7 THEN N'ÏÑÎæÇÓÊ ˜ÇáÇ'
                END AS NVARCHAR(512)) AS BaseTypeString ,
		case when @CultureNo = 1 then pt.Title
	            when @CultureNo = 2 then pt.Title2
	       end as TypeString

    FROM   VND.PurchaseContract AS sr
           JOIN VND.PurchaseType AS pt ON pt.PurchaseTypeID = sr.[Type]
           LEFT JOIN CFG.Branch AS b ON b.BranchID = sr.BranchID
          INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = b.BranchID
    WHERE  @Outgoing IS NULL
           AND @TemporaryStockReceipt IS NULL
           AND @StockReceipt IS NULL
           AND @JustificationInput IS NULL
           AND @ReturnedTemporaryStockReceipt IS NULL
           AND @ReturnRequest IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.PurchaseContractID IN (   SELECT main.PurchaseContractID
                                            FROM   VND.PurchaseContractItem AS main --------------
                                                   LEFT JOIN REQ.StuffRequest_PurchaseContract AS vw1 ON vw1.PurchaseContractItemID = main.PurchaseContractItemID
                                                   LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID

                                                   --------------
                                                   LEFT JOIN REQ.PurchaseRequest_PurchaseContract AS vw2 ON vw2.PurchaseContractItemID = main.PurchaseContractItemID
                                                   LEFT JOIN REQ.PurchaseRequestItem AS pri ON pri.PurchaseRequestItemID = vw2.PurchaseRequestItemID

                                                   --------------
                                                   LEFT JOIN VND.Proposal_PurchaseContract AS vw6 ON vw6.PurchaseContractItemID = main.PurchaseContractItemID
                                                   LEFT JOIN VND.ProposalItem AS pi1 ON pi1.ProposalItemID = vw6.ProposalItemID
                                            WHERE  (   @StuffRequest IS NULL
                                                       OR sri.StuffRequestID IN (   SELECT value
                                                                                    FROM   CFG.R_FnCommaStr2Table(
                                                                                               @StuffRequest) ))
                                                   AND (   @PurchaseRequest IS NULL
                                                           OR pri.PurchaseRequestID IN (   SELECT value
                                                                                           FROM   CFG.R_FnCommaStr2Table(
                                                                                                      @PurchaseRequest) ))
                                                   AND (   @Proposal IS NULL
                                                           OR pi1.ProposalID IN (   SELECT value
                                                                                    FROM   CFG.R_FnCommaStr2Table(
                                                                                               @Proposal) )));
