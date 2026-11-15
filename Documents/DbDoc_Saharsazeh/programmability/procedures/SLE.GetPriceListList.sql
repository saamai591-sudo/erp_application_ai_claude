
-------------------------------------
Create   PROCEDURE [SLE].GetPriceListList
    (
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
                @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX) ,
                @Culture VARCHAR(10),
                @UnauthorizedUsers NVARCHAR(MAX);

        SET @Culture = CFG.GetuserCulture();

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
		WHERE EntityName = 'PriceList'
			  AND AccessKey = 'ViewRelatedToUser'
			  AND UserID = @UserID;

		SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
		FROM CFG.vwOperationLevelAccess
		WHERE EntityName = 'PriceList'
			  AND AccessKey = 'ViewRelatedToOthers'
			  AND UserID = @UserID;

        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'EffectiveDate ';

        DECLARE @Query NVARCHAR(MAX);

        SET @Query = '
			WITH Query_Result 
			(
				PriceListID ,
				IsActive,
                IsAppropriateFeeEditable,
				EffectiveDate ,
				SaleModelID ,
				CurrencyID ,
				Version ,
				Creator ,
				CreationDate ,
				LastEditor ,
				LastEditionDate  ,
				SaleModelTitle,
				SaleModelTitle2,
				CurrencyTitle,
				CurrencyTitle2,
				Date_EffectiveDate,
				CreateDateString,
				EditionDateString,
				CreatorUserName,
				EditorName
			)
	     AS
			(
			SELECT 
			   pl.PriceListID ,
			   pl.IsActive ,
               IsAppropriateFeeEditable,
			   pl.EffectiveDate ,
			   pl.SaleModelID ,
			   pl.CurrencyID ,
			   pl.Version ,
			   pl.Creator ,
			   pl.CreationDate ,
			   pl.LastEditor ,
			   pl.LastEditionDate  ,
			   sm.Title AS SaleModelTitle,
			   sm.Title2 AS SaleModelTitle2,
			   c.Title AS  CurrencyTitle,
			   c.Title2 AS  CurrencyTitle2,
			   CFG.GetCLRSaturnDate(pl.EffectiveDate, @DateFormat, 0, @DateType) AS Date_EffectiveDate,
			   CFG.GetCLRSaturnDate(pl.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
			   CFG.GetCLRSaturnDate(pl.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
			   u.Name AS CreatorUserName,
			   u2.Name AS EditorName
			FROM SLE.PriceList pl
			INNER JOIN SLE.SaleModel sm ON sm.SaleModelID = pl.SaleModelID
			INNER JOIN SLE.vwSaleModelAccess vsm ON vsm.SaleModelID = pl.SaleModelID
			INNER JOIN CFG.Currency c ON c.CurrencyID = pl.CurrencyID
			INNER JOIN CFG.[User] AS u ON  u.UserID = pl.Creator
			INNER JOIN CFG.[User] AS u2 ON  u2.UserID = pl.LastEditor
			WHERE   @UserID = -1
	                OR (@ViewRelatedToUser IS NOT NULL AND pl.Creator = @UserID)
	                OR (@ViewRelatedToOthers IS NOT NULL AND pl.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst))
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

        EXECUTE sp_executesql @Query ,
                              N'
			@UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @UnauthorizedUsers   NVARCHAR(MAX)
	       ' ,
                              @UserID = @UserID ,
                              @DateType = @DateType ,
                              @DateFormat = @DateFormat ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers,
                              @UnauthorizedUsers = @UnauthorizedUsers;

        DECLARE @Count INT;


        EXEC ( 'select * from ' + @tableName + ' ORDER BY _RN ' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);

    END;
