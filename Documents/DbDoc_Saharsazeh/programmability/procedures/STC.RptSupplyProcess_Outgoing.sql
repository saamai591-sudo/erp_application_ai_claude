------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].RptSupplyProcess_Outgoing
    (
        @FinancialPeriod INT ,
        @FromDate DATE ,
        @EndDate DATE ,
        @StuffRequest VARCHAR(MAX) = NULL ,
        @PurchaseRequest VARCHAR(MAX) = NULL ,
        @JustificationInput VARCHAR(MAX) = NULL ,
        @Proposal VARCHAR(MAX) = NULL ,
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

    -----------------------

    DECLARE @Sale NVARCHAR(100) ,
            @Consume NVARCHAR(100) ,
            @Trust NVARCHAR(100) ,
            @Transfer NVARCHAR(100) ,
            @Spoilages NVARCHAR(100) ,
            @Other NVARCHAR(100) ,
            @StockRecounting NVARCHAR(100) ,
            @Asset NVARCHAR(100);

    SELECT @Sale = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Sale'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Consume = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Consume'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Trust = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Trust'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Transfer = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Transfer'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Spoilages = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Spoilages'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Other = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Other'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @StockRecounting = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'StockRecounting'
           AND LV.Culture = CFG.GetuserCulture();

    SELECT @Asset = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'OutgoingTypes'
           AND L.Item = 'Asset'
           AND LV.Culture = CFG.GetuserCulture();

		   
    SELECT sr.OutgoingID ,
           sr.Number ,
		   sr.[Date],
           CFG.GetCLRSaturnDate(sr.[Date], @DateFormat, 0, @DateType) AS [Date_Date] ,
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end as StockTitle,
           s.Code AS StockCode ,
		   case when @CultureNo = 1 then sdt.Title
	            when @CultureNo = 2 then sdt.Title2
	       end as [Type]
		   
    FROM   STC.Outgoing AS sr
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
        ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
           JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
           LEFT JOIN STF.Stock AS s ON s.StockID = sr.StockID
           INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = s.StockID
    WHERE  @ReturnedTemporaryStockReceipt IS NULL
           AND @PurchaseRequest IS NULL
           AND @PurchaseInvoice IS NULL
           AND @StockReceipt IS NULL
           AND @Proposal IS NULL
           AND @JustificationInput IS NULL
           AND @ReturnRequest IS NULL
           AND @TemporaryStockReceipt IS NULL
           AND @PurchaseContract IS NULL
           AND sr.FinancialPeriodID = @FinancialPeriod
           AND (   @FromDate IS NULL
                   OR sr.[Date] >= @FromDate )
           AND (   @EndDate IS NULL
                   OR sr.[Date] <= @EndDate )
           AND sr.OutgoingID IN (   SELECT main.OutgoingID
                                    FROM   STC.OutgoingItem AS main

                                           --------------

                                           LEFT JOIN REQ.StuffRequest_Outgoing AS vw1 ON vw1.OutgoingItemID = main.OutgoingItemID
                                           LEFT JOIN REQ.StuffRequestItem AS sri ON sri.StuffRequestItemID = vw1.StuffRequestItemID
                                    WHERE  (   @StuffRequest IS NULL
                                               OR sri.StuffRequestID IN (   SELECT value
                                                                            FROM   CFG.R_FnCommaStr2Table(
                                                                                       @StuffRequest) )));



