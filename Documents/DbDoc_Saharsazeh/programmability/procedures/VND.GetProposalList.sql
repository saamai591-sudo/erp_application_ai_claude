---------------------------------------------[VND].GetProposalList-----------------------------------------------------------
CREATE     PROCEDURE [VND].GetProposalList
    (
        @financialPeriodId INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Internal NVARCHAR(100) ,
                @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX) ,
                @Importable NVARCHAR(100) ,
                @Culture VARCHAR(10) ,
                @WithOutbase NVARCHAR(100) ,
                @PurchaseRequest NVARCHAR(100) ,
                @PurchasePlanning NVARCHAR(100) ,
                @Submit NVARCHAR(100) ,
                @Confirmed NVARCHAR(100) ,
                @Ended NVARCHAR(100),
                @UnauthorizedUsers NVARCHAR(MAX);

        SET @UserID = CFG.GetuserID();

        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;

        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
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

        SET @Culture = CFG.GetuserCulture();

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

        SELECT @PurchaseRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'PurchaseRequest'
               AND LV.Culture = @Culture;
               
        SELECT @PurchasePlanning = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'PurchasePlanning'
               AND LV.Culture = @Culture;

        SELECT @Submit = Value
        FROM   CFG.LocalizeEnum l
               JOIN CFG.LocalizeEnumValue v ON l.LocalizeEnumID = v.LocalizeEnumID
        WHERE  Enum = 'Statuses'
               AND Item = 'Submit'
               AND Culture = CFG.GetuserCulture();

        SELECT @Ended = Value
        FROM   CFG.LocalizeEnum l
               JOIN CFG.LocalizeEnumValue v ON l.LocalizeEnumID = v.LocalizeEnumID
        WHERE  Enum = 'RequestStates'
               AND Item = 'Ended'
               AND Culture = CFG.GetuserCulture();

        SELECT @Confirmed = Value
        FROM   CFG.LocalizeEnum l
               JOIN CFG.LocalizeEnumValue v ON l.LocalizeEnumID = v.LocalizeEnumID
        WHERE  Enum = 'Statuses'
               AND Item = 'Confirmed'
               AND Culture = CFG.GetuserCulture();

	    SELECT @ViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'Proposal'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;

	    SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'Proposal'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;


        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';

        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
 		WITH Query_Result 
		(
			ProposalID  ,
			PartyID  ,
			BaseDocument,
			BaseDocumentString,
			BranchID  ,
			FinancialPeriodID  ,
			QuotationNumber  ,
			QuotationDate  ,
			Number  ,
			[Date]  ,
			CurrencyID  ,
			TotalPrice  ,
			TotalDiscount  ,
			TotalTax  ,
			TotalDuty  ,
			Creator  ,
			CreationDate  ,
			LastEditor  ,
			LastEditionDate  ,
			[Version]  ,
			TotalNetPrice  ,
			Date_Date  ,
			CreateDateString  ,
			EditionDateString  ,
			CreatorUserName  ,
			EditorName  ,
			BranchCode  ,
			BranchTitle,
			BranchTitle2,
			VendorCode  ,
			VendorTitle,
			VendorTitle2,
			CurrencyTitle,
			CurrencyTitle2,
			Date_QuotationDate  ,
			[ExpireDate] ,
			StatusString
		)
		as
		(
		 SELECT p.ProposalID ,
                p.PartyID ,
				p.BaseDocument,
				CASE p.BaseDocument
				WHEN 1 THEN @WithOutbase
				WHEN 2 THEN @PurchaseRequest
                When 17 THEN @PurchasePlanning
				END BaseDocumentString,
                p.BranchID ,
                p.FinancialPeriodID ,
                p.QuotationNumber ,
                p.QuotationDate ,
                p.Number ,
                p.[Date] ,
                p.CurrencyID ,
                p.TotalPrice ,
                p.TotalDiscount ,
                p.TotalTax ,
                p.TotalDuty ,
                p.Creator ,
                p.CreationDate ,
                p.LastEditor ,
                p.LastEditionDate ,
                p.[Version] ,
                ( p.TotalPrice - p.TotalDiscount + p.TotalTax + p.TotalDuty ) TotalNetPrice ,
                CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) AS Date_Date ,
                CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
                CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
                u.Name AS CreatorUserName ,
                u2.Name AS EditorName ,
                b.Code AS BranchCode ,
                b.Title AS BranchTitle,
				b.Title2 AS BranchTitle2,
                d.Code AS VendorCode ,
                ISNULL(pp.Title, '''') + '' '' + ISNULL(pp.LastName, '''') AS VendorTitle,
				ISNULL(pp.Title2, '''') + '' '' + ISNULL(pp.LastName2, '''') AS VendorTitle2,
                c.Title AS CurrencyTitle,
				c.Title2 AS CurrencyTitle2,
                CFG.GetCLRSaturnDate(p.QuotationDate, @DateFormat, 0, @DateType) AS Date_QuotationDate ,
                p.ExpireDate,
				CASE WHEN p.Status = 3 THEN  @Ended
						WHEN p.Status = 2 THEN  @Confirmed
					ELSE  @Submit 
				END StatusString
        FROM    VND.Proposal p
                JOIN CFG.[User] AS u ON u.UserID = p.Creator
                JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor
                LEFT JOIN CFG.Branch b ON b.BranchID = p.BranchID
                LEFT JOIN CFG.Currency c ON c.CurrencyID = p.CurrencyID
                LEFT JOIN CFG.Party pp ON pp.PartyID = p.PartyID
                LEFT JOIN ACC.DL d ON d.DLID = pp.DlID
                INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = p.BranchID
        WHERE  p.FinancialPeriodID = @financialPeriodId
               AND ( @UserID = -1
                    OR ( @ViewRelatedToUser IS NOT NULL AND p.Creator = @UserID)
                    OR ( @ViewRelatedToOthers IS NOT NULL AND p.Creator NOT IN ( SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
                )
	        )
	'   ;

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
            @Internal NVARCHAR(100) ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @UnauthorizedUsers   NVARCHAR(MAX) ,
            @Importable NVARCHAR(100),
            @WithOutbase NVARCHAR(100),			
            @Confirmed NVARCHAR(100),
            @Ended NVARCHAR(100),
            @Submit NVARCHAR(100),
            @PurchaseRequest NVARCHAR(100),
            @PurchasePlanning NVARCHAR(100),
			@financialPeriodId int
	'   ,
    @UserID = @UserID ,
    @DateType = @DateType ,
    @DateFormat = @DateFormat ,
    @Internal = @Internal ,
    @ViewRelatedToUser = @ViewRelatedToUser ,
    @ViewRelatedToOthers = @ViewRelatedToOthers ,
    @UnauthorizedUsers = @UnauthorizedUsers ,
    @WithOutbase = @WithOutbase ,
    @PurchaseRequest = @PurchaseRequest ,
    @PurchasePlanning = @PurchasePlanning ,
    @Importable = @Importable ,
    @financialPeriodId = @financialPeriodId ,
    @Confirmed = @Confirmed ,
    @Ended = @Ended ,
    @Submit = @Submit;

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);
    END;

