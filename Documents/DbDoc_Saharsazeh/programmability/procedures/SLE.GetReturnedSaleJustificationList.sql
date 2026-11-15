CREATE    PROCEDURE SLE.GetReturnedSaleJustificationList
    (
        @FinancialPeriodId INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
-- WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Submit NVARCHAR(100) ,
                @Revoke NVARCHAR(100) ,
                @Internal NVARCHAR(100) ,
                @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX) ,
                @Export NVARCHAR(100),
                @UnauthorizedUsers NVARCHAR(MAX);

        SELECT @Revoke = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'Statuses'
               AND L.Item = 'Revoke'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Submit = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'Statuses'
               AND L.Item = 'Submit'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Internal = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TradeType'
               AND L.Item = 'Internal'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Export = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TradeType'
               AND L.Item = 'Export'
               AND LV.Culture = CFG.GetuserCulture();

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

	    SELECT @ViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ReturnedSaleJustification'
		        AND AccessKey = 'ViewRelatedToUser'
		        AND UserID = @UserID;

	    SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ReturnedSaleJustification'
		        AND AccessKey = 'ViewRelatedToOthers'
		        AND UserID = @UserID;

        DECLARE @WithOutbase NVARCHAR(100) ,
                @Invoice NVARCHAR(100);

        SELECT @WithOutbase = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'WithOutbase'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Invoice = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'Invoice'
               AND LV.Culture = CFG.GetuserCulture();

        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';
            
        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
 		WITH Query_Result 
		(
			ReturnedSaleJustificationID	,
			BaseDocument				,
			[SaleTypeId]				,
			BranchID					,
			BranchName					,
			BranchName2					,
			BranchCode					,
			CustomerID					,
			CustomerName				,
			CustomerName2				,
			CustomerDlCode				,
			CustomerSubscription		,
			[Status]					,
			Number						,
			[Date]						,
			FinancialPeriodID			,
			SaleType					,
			[Version]					,
			Creator						,
			CreationDate				,
			Date_Date					,
			CreateDateString			,
			EditionDateString			,
			CreatorUserName				,
			EditorName					,
			LastEditionDate				,
			
				SaleAreaId    ,
				SaleAreaTitle,
				SaleAreaTitle2,

			StatusString				,
			BaseDocumentString
		)
		as
		(
			SELECT *,
			CAST( CASE  WHEN [Status]= 2 THEN  @Revoke
			 							 ELSE  @Submit  
			END AS NVARCHAR(512))AS StatusString,
				CASE BaseDocument 
					WHEN 1 THEN @WithOutbase		
					WHEN 6 THEN @Invoice
			END AS BaseDocumentString		
			FROM (
				SELECT	rsj.ReturnedSaleJustificationID,
						rsj.BaseDocument,
						rsj.[SaleTypeId],
						rsj.BranchID,
						b.Title AS BranchName,
						b.Title2 AS BranchName2,
						b.Code AS BranchCode,
						rsj.CustomerID,
						d.Title AS CustomerName,
						d.Title2 AS CustomerName2,
						d.Code AS CustomerDlCode,
						p.CustomerCode AS CustomerSubscription,
						rsj.[Status],
						rsj.Number,
						rsj.[Date],
						rsj.FinancialPeriodID,
						sty.Title AS SaleType,
						rsj.[Version],
						rsj.Creator,
						rsj.CreationDate,	
						CFG.GetCLRSaturnDate(rsj.[Date], @DateFormat  , 0, @DateType) AS Date_Date, 	        
						CFG.GetCLRSaturnDate(rsj.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
						CFG.GetCLRSaturnDate(rsj.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
						u.Name AS CreatorUserName, 
						u2.Name AS EditorName,
						rsj.LastEditionDate	,
						
								rsj.SaleAreaId,
								sa.Title AS SaleAreaTitle,
								sa.Title2 AS SaleAreaTitle2		
					FROM SLE.ReturnedSaleJustification rsj
						join SLE.SaleType sty on sty.SaleTypeId = rsj.SaleTypeId
									left join SLE.SaleArea sa on sa.SaleAreaId = rsj.SaleAreaId
						JOIN CFG.[User] AS u ON u.UserID = rsj.Creator 
						JOIN CFG.[User] AS u2 ON u2.UserID = rsj.LastEditor
						JOIN CFG.Branch b ON b.BranchID = rsj.BranchID
						JOIN CFG.Party p ON p.PartyID = rsj.CustomerID
						JOIN ACC.DL d ON p.DLID = d.DLID
						INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = rsj.BranchID
						INNER JOIN cfg.vwSaleAreaAccess AS vsaa ON vsaa.SaleAreaID = rsj.SaleAreaID
						INNER JOIN cfg.vwPartyAccess AS vpa ON vpa.PartyID=rsj.CustomerID

					WHERE rsj.FinancialPeriodID = @FinancialPeriodID 
					    and (@UserID = -1 
					        or  (@ViewRelatedToUser is not null   and rsj.Creator = @UserID)
					        or  (@ViewRelatedToOthers IS NOT NULL AND rsj.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
                        )
                    )
				)T
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

        EXECUTE sp_executesql @Query ,  N'
			@FinancialPeriodId INT,
			@UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Submit NVARCHAR(100),				
			@Revoke NVARCHAR(100),
			@Internal NVARCHAR(100),
			@WithOutbase NVARCHAR(100),
			@Invoice NVARCHAR(100),
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers NVARCHAR(MAX),
			@Export NVARCHAR(100)
	'   ,
                              @UserID = @UserID ,
                              @DateType = @DateType ,
                              @DateFormat = @DateFormat ,
                              @Submit = @Submit ,
                              @Revoke = @Revoke ,
                              @Internal = @Internal ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers ,
                              @UnauthorizedUsers = @UnauthorizedUsers ,
                              @Export = @Export ,
                              @WithOutbase = @WithOutbase ,
                              @Invoice = @Invoice ,
                              @FinancialPeriodId = @FinancialPeriodId;


        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);
    END;
