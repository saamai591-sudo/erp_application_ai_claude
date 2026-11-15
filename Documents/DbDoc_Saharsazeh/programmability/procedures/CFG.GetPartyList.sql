CREATE   PROCEDURE [CFG].[GetPartyList]
(
    @Role           TINYINT = NULL,
    @PageNumber     INT,
    @RowspPage      INT,
    @Sort           NVARCHAR(MAX) = NULL,
    @Filter         NVARCHAR(MAX) = NULL
)
AS
	DECLARE @NaturalPerson                  NVARCHAR(512),
	        @NonGovernmentalLegalPerson     NVARCHAR(512),
			@CivilPartnership				NVARCHAR(512),
	        @GovernmentalLegalPerson        NVARCHAR(512),
	        @FinalConsumer					NVARCHAR(512),
	        @UserID                         INT,
	        @DateType                       TINYINT,
	        @ViewRelatedToUser              INT,
	        @ViewRelatedToOthers            NVARCHAR(MAX),
	        @DateFormat                     VARCHAR(10),
            @UnauthorizedUsers				NVARCHAR(MAX);
	
	SET @UserID = CFG.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = UPPER(us.SettingValue)
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD'  
	
	SELECT @NaturalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'NaturalPerson'
	       AND LV.Culture = CFG.GetuserCulture()
	
	SELECT @NonGovernmentalLegalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'NonGovernmentalLegalPerson'
	       AND LV.Culture = CFG.GetuserCulture()

	SELECT @CivilPartnership = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'CivilPartnership'
	       AND LV.Culture = CFG.GetuserCulture()
	
	SELECT @GovernmentalLegalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'GovernmentalLegalPerson'
	       AND LV.Culture = CFG.GetuserCulture()
	

	SELECT @FinalConsumer = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'FinalConsumer'
	       AND LV.Culture = CFG.GetuserCulture()
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Party'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Party'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'DlCode '
	    
	    
	    SELECT * INTO #vwPartyAccess
	    FROM cfg.vwPartyAccess AS vpa
	
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	N'WITH Query_Result 
			(
				ViewModelId,
				PartyID   ,
				[Type]   ,
				PartyTypeName   ,
				Title   ,
				Title2   ,
				IdentificationCode  ,
				RegisterCode,
				EconomicCode  ,
				IsActive  ,
				IsInBlackList  ,
				IsCustomer  ,
				CreditControl  ,
				CustomerCredit  ,
				IsDetterent  ,
				IsVendor  ,
				[Version]  ,
				DlID   ,
				CustomerGroupID ,
				IntroductionID ,
				VendorGroupID ,
				ExemptFromTax  ,
				CustomerCode ,
				NationalID ,
				LastName ,
				LastName2 ,
				CreateDateString   ,
				EditionDateString   ,
				CreatorUserName   ,
				EditorName   ,
				DlCode   ,
				DlTitle ,
				DlTitle2 ,
				ParentDlCode   ,
				ParentDlTitle ,
				ParentDlTitle2 ,
				CustomerGroupName ,
				IntroductionName ,
				VendorGroupName ,
				Email  ,
				IsReceptionist  ,
				TradeName  ,
				TradeName2 ,
				Creator,
				Nationality ,
				FidaCode ,
				FidaIdCode ,
				NationalityTitle,
				NationalityTitle2,
				CreationDate,
				LastEditionDate,
				IsShoppingCardExporter
			)
			As (
				
				 SELECT p.PartyID AS ViewModelId,
						p.PartyID ,
                        p.[Type] ,
                        CASE p.[Type]
                          WHEN 0 THEN @NaturalPerson
                          WHEN 1 THEN @NonGovernmentalLegalPerson
                          WHEN 2 THEN @GovernmentalLegalPerson
						  WHEN 3 THEN @FinalConsumer
						  WHEN 4 THEN @CivilPartnership
                        END AS PartyTypeName ,
                        p.Title ,
                        p.Title2 ,
                        p.IdentificationCode ,
                        p.RegisterCode,
                        p.EconomicCode ,
                        p.IsActive ,
                        p.IsInBlackList ,
                        p.IsCustomer ,
                        p.CreditControl ,
                        p.CustomerCredit ,
                        p.IsDetterent ,
                        p.IsVendor ,
                        p.[Version] ,
                        p.DlID ,
                        p.CustomerGroupID ,
                        p.IntroductionID ,
                        p.VendorGroupID ,
                        p.ExemptFromTax ,
                        p.CustomerCode ,
                        p.NationalID ,
                        p.LastName ,
                        p.LastName2 ,
                        CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
                        CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
                        u.Name AS CreatorUserName ,
                        u2.Name AS EditorName ,
                        d.Code AS DlCode ,
                        d.Title AS DlTitle ,
                        d.Title2 AS DlTitle2 ,
                        d2.Code AS ParentDlCode ,
                        d2.Title AS ParentDlTitle ,
                        d2.Title2 AS ParentDlTitle2 ,
                        g.Title AS CustomerGroupName ,                        
                        p.IntroductionName ,
                        g2.Title AS VendorGroupName ,
                        p.Email ,
                        p.IsReceptionist ,
                        p.TradeName ,
                        p.TradeName2,
                        p.Creator,
						p.Nationality ,
						p.FidaCode ,
						p.FidaIdCode ,
						ldi.Title NationalityTitle,
						ldi.Title2 NationalityTitle2,
						p.CreationDate,
						p.LastEditionDate,
						p.IsShoppingCardExporter
                FROM    CFG.Party AS p
						JOIN #vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
                        JOIN CFG.[User] AS u ON u.UserID = p.Creator
                        JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor
                        LEFT JOIN ACC.DL d ON d.DLID = p.DlID
                        LEFT JOIN ACC.DL d2 ON d2.DLID = d.ParentID
                        LEFT JOIN CFG.[Group] g ON g.GroupID = p.CustomerGroupID                        
                        LEFT JOIN CFG.[Group] g2 ON g2.GroupID = p.VendorGroupID
                        LEFT JOIN CFG.Introduction i ON i.IntroductionID = p.IntroductionID
						JOIN CFG.LookupDataItem AS ldi ON ldi.LookupDataItemID = p.Nationality
                WHERE ( 
						( p.IsCustomer = 1 AND @Role = 1)
                          OR ( @Role IS NULL )
                          OR ( @Role = 2  AND p.IsVendor = 1 )
                          OR ( @Role = 3 AND p.IsReceptionist = 1 )
						)
                        AND ( @UserID = -1
                              OR ( @ViewRelatedToUser IS NOT NULL AND p.Creator = @UserID )
                              OR ( @ViewRelatedToOthers IS NOT NULL AND p.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                        )
                    )
			) 
	    '
	
	
	
	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	
	
	SET @Query = Cfg.ApplyPaging (
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    )
		
	EXECUTE sp_executesql @Query,
	     N'@dateFormat						varchar(10),
		   @dateType						int,
		   @ViewRelatedToOthers				NVARCHAR(MAX),
		   @UnauthorizedUsers				NVARCHAR(MAX),
		   @Role							tinyint,
		   @UserID							int,
		   @ViewRelatedToUser				int,
		   @NaturalPerson					NVARCHAR(512),
		   @NonGovernmentalLegalPerson		NVARCHAR(512),
		   @CivilPartnership				NVARCHAR(512),
		   @GovernmentalLegalPerson			NVARCHAR(512),
		   @FinalConsumer					NVARCHAR(512)',
	     @NaturalPerson = @NaturalPerson,
	     @NonGovernmentalLegalPerson = @NonGovernmentalLegalPerson,
		 @CivilPartnership = @CivilPartnership,
	     @GovernmentalLegalPerson = @GovernmentalLegalPerson,
		 @FinalConsumer = @FinalConsumer,
	     @DateType = @DateType,
	     @Role = @Role,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID;
	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName + ' order by _RN')
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
