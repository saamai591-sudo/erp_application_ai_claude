
--------------------------------------------------------------
CREATE   PROCEDURE SLE.GetQuotationList
    (
        @FinancialPeriodID INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Submit NVARCHAR(100) ,
            @Revoke NVARCHAR(100) ,
            @Confirmed NVARCHAR(100) ,
            @WithOutbase NVARCHAR(100) ,
            @Justification NVARCHAR(100) ,
            @Quotation NVARCHAR(100) ,
            @Remittance NVARCHAR(100) ,
            @Order NVARCHAR(100) ,
            @Invoice NVARCHAR(100) ,
            @Outgoing NVARCHAR(100) ,
            @ReturnedSaleInvoice NVARCHAR(100) ,
            @ReturnedSaleJustification NVARCHAR(100) ,
            @Internal NVARCHAR(100) ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @Export NVARCHAR(100) ,
            @Culture VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);


select * into 	#vwBranchAccess from 	cfg.vwBranchAccess	 where UserID = cfg.GetUserID()
select * into 	#vwSaleAreaAccess from 	cfg.vwSaleAreaAccess	 where UserID = cfg.GetUserID()
select * into 	#vwPartyAccess from 	cfg.vwPartyAccess	 where UserID = cfg.GetUserID()



    SET @Culture = CFG.GetuserCulture();
    SELECT @Revoke = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'RequestStates'
           AND L.Item = 'Ended'
           AND LV.Culture = @Culture;

    SELECT @Submit = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'Statuses'
           AND L.Item = 'Submit'
           AND LV.Culture = @Culture;

    SELECT @Confirmed = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'Statuses'
           AND L.Item = 'Confirmed'
           AND LV.Culture = @Culture;

    SELECT @WithOutbase = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'WithOutbase'
           AND LV.Culture = @Culture;

    SELECT @Justification = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Justification'
           AND LV.Culture = @Culture;

    SELECT @Quotation = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Quotation'
           AND LV.Culture = @Culture;

    SELECT @Remittance = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Remittance'
           AND LV.Culture = @Culture;

    SELECT @Order = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Order'
           AND LV.Culture = @Culture;

    SELECT @Invoice = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Invoice'
           AND LV.Culture = @Culture;

    SELECT @Outgoing = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'Outgoing'
           AND LV.Culture = @Culture;

    SELECT @ReturnedSaleInvoice = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'ReturnedSaleInvoice'
           AND LV.Culture = @Culture;

    SELECT @ReturnedSaleJustification = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'SaleDocumentBases'
           AND L.Item = 'ReturnedSaleJustification'
           AND LV.Culture = @Culture;


    SELECT @Internal = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TradeType'
           AND L.Item = 'Internal'
           AND LV.Culture = @Culture;

    SELECT @Export = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'TradeType'
           AND L.Item = 'Export'
           AND LV.Culture = @Culture;

    SET @UserID = CFG.GetuserID();

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
        
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Quotation'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Quotation'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';

    DECLARE @Query NVARCHAR(MAX);
    SET @Query = '
	    WITH Query_Result 
		(
			QuotationID ,
			ExpirationDate,
			CurrencyID ,
			CurrencyName,
			CurrencyName2,
			TotalPrice ,
			TotalDiscount ,
			TotalNetPrice ,
			TotalTax ,
			TotalDuty ,
			BaseDocument ,
			SaleTypeId ,
			BranchID ,
			BranchName,
			BranchName2,
			BranchCode ,
			CustomerID ,
			CustomerName ,
			CustomerName2 ,
			CustomerDlCode ,
			CustomerSubscription ,
			Status ,
			Number ,
			Date,
			FinancialPeriodID ,
			AddressID ,
			Version ,
			Creator ,
			CreationDate,
            LastEditionDate,
			Date_Date ,     
			CreateDateString ,
			EditionDateString ,
			CreatorUserName ,
			EditorName ,
			SaleTypeTitle ,
			SaleAreaId    ,
			SaleAreaTitle,
			SaleAreaTitle2,
			StatusString ,
			BaseDocumentName 
		)
		as
		(
			SELECT *,
		CAST( CASE  WHEN [Status]= 2 THEN  @Revoke
					WHEN [Status]= 3 THEN  @Confirmed
			 						 ELSE  @Submit  
		END AS NVARCHAR(512))AS StatusString ,
		CAST(  CASE  BaseDocument
		WHEN  1 THEN  @WithOutbase
		WHEN  2 THEN  @Order
		WHEN  3 THEN  @Justification
		WHEN  4 THEN  @Quotation
		WHEN  5 THEN  @Remittance			
		WHEN  6 THEN  @Invoice
		WHEN  7 THEN  @ReturnedSaleJustification
		WHEN  8 THEN  @ReturnedSaleInvoice
		WHEN  9 THEN  @Outgoing
		
		ELSE ''''  END AS NVARCHAR(200)) AS BaseDocumentName
		
		FROM (		
				SELECT	q.QuotationID,
						q.ExpirationDate,
						q.CurrencyID,
						c.Title AS CurrencyName,
						c.Title2 AS CurrencyName2,
						q.TotalPrice,
						q.TotalDiscount,
						q.TotalNetPrice,
						q.TotalTax,
						q.TotalDuty,
						q.BaseDocument,
						q.[SaleTypeId],
						q.BranchID,
						b.Title AS BranchName,
						b.Title2 AS BranchName2,
						b.Code AS BranchCode,
						q.CustomerID,
						d.Title AS CustomerName,
						d.Title2 AS CustomerName2,
						d.Code AS CustomerDlCode,
						p.CustomerCode AS CustomerSubscription,
						q.[Status],
						q.Number,
						q.[Date],
						q.FinancialPeriodID,
						q.AddressID,
						q.[Version],
						q.Creator,
						q.CreationDate,	
                        q.LastEditionDate,
						CFG.GetCLRSaturnDate(q.[Date], @DateFormat  , 0, @DateType) AS Date_Date, 	        
						CFG.GetCLRSaturnDate(q.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
						CFG.GetCLRSaturnDate(q.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
						u.Name AS CreatorUserName, 
						u2.Name AS EditorName	,
						sty.Title AS SaleType	,
								q.SaleAreaId,
								sa.Title AS SaleAreaTitle,
								sa.Title2 AS SaleAreaTitle2
						
				FROM SLE.Quotation q
				    JOIN SLE.SaleType sty on sty.SaleTypeId = q.SaleTypeId
					left join SLE.SaleArea sa on sa.SaleAreaId = q.SaleAreaId
				    JOIN CFG.[User] AS u ON u.UserID = q.Creator 
				    JOIN CFG.[User] AS u2 ON u2.UserID = q.LastEditor
				    JOIN CFG.Branch b ON b.BranchID = q.BranchID
				    JOIN CFG.Party p ON p.PartyID = q.CustomerID
				    left JOIN ACC.DL d ON p.DLID = d.DLID
				    JOIN CFG.Currency c ON c.CurrencyID = q.CurrencyID
				    INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = q.BranchID
				    INNER JOIN #vwSaleAreaAccess AS vsaa ON vsaa.SaleAreaID = q.SaleAreaID
				    INNER JOIN #vwPartyAccess AS vpa ON vpa.PartyID=q.CustomerID
								
				WHERE q.FinancialPeriodID = @FinancialPeriodID 
				    and (@UserID = -1 
				        or  (@ViewRelatedToUser is not null   and q.Creator = @UserID)
				        or  (@ViewRelatedToOthers IS NOT NULL AND q.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst))
                    )
				)T
			)
			';
    PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';

    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(
                     @tableName ,
                     @Query ,
                     @PageNumber ,
                     @RowspPage ,
                     @Filter ,
                     @Sort);
    --PRINT @Query

    EXECUTE sp_executesql @Query ,
                          N'
			@UserID INT ,
			@DateType TINYINT ,
			@DateFormat VARCHAR(10) ,
			@Submit NVARCHAR(100) ,
			@Revoke NVARCHAR(100) ,
			@Confirmed NVARCHAR(100) ,
			@WithOutbase NVARCHAR(100) ,
			@Justification NVARCHAR(100) ,
			@Quotation NVARCHAR(100) ,
			@Remittance NVARCHAR(100) ,
			@Order NVARCHAR(100) ,
			@Invoice NVARCHAR(100) ,
			@Outgoing NVARCHAR(100) ,
			@ReturnedSaleInvoice NVARCHAR(100) ,
			@ReturnedSaleJustification NVARCHAR(100) ,
			@Internal NVARCHAR(100) ,
			@ViewRelatedToUser INT ,
			@ViewRelatedToOthers NVARCHAR(MAX) ,
			@UnauthorizedUsers   NVARCHAR(MAX) ,
			@Export NVARCHAR(100),
			@FinancialPeriodID INT
	     ' ,
                          @UserID = @UserID ,
                          @DateType = @DateType ,
                          @DateFormat = @DateFormat ,
                          @Submit = @Submit ,
                          @Revoke = @Revoke ,
                          @Confirmed = @Confirmed ,
                          @WithOutbase = @WithOutbase ,
                          @Justification = @Justification ,
                          @Quotation = @Quotation ,
                          @Remittance = @Remittance ,
                          @Order = @Order ,
                          @Invoice = @Invoice ,
                          @Outgoing = @Outgoing ,
                          @ReturnedSaleInvoice = @ReturnedSaleInvoice ,
                          @ReturnedSaleJustification = @ReturnedSaleJustification ,
                          @Internal = @Internal ,
                          @ViewRelatedToUser = @ViewRelatedToUser ,
                          @ViewRelatedToOthers = @ViewRelatedToOthers ,
                          @UnauthorizedUsers = @UnauthorizedUsers ,
                          @Export = @Export ,
                          @FinancialPeriodID = @FinancialPeriodID;

    DECLARE @Count INT;

    EXEC ( 'select * from ' + @tableName + ' ORDER BY _RN' );

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query ,
                          N'@count int out' ,
                          @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
