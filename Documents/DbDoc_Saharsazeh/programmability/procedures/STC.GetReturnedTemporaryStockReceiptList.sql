
--------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].GetReturnedTemporaryStockReceiptList
    (
        @FinancialPeriodId INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @TempReceipt NVARCHAR(100) ,
                @ReturnRequest NVARCHAR(100) ,
                @WithoutBase NVARCHAR(100) ,
                @UserID INT ,
				@CultureNo tinyint,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10);

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = CFG.GetuserCulture();

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

        SELECT @ReturnRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
               AND L.Item = 'ReturnRequest'
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


        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';


        DECLARE @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX),
				@UnauthorizedUsers NVARCHAR(MAX)

    	SELECT @ViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ReturnedTemporaryStockReceipt'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;

	    SELECT @ViewRelatedToOthers = UserID ,
			   @UnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ReturnedTemporaryStockReceipt'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;

        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
 		WITH Query_Result 
		(
			ReturnedTemporaryStockReceiptID,
			StockDocumentTypeBaseEntityID,
			StockDocumentTypeTitle,
			BaseEntity,
			BaseEntityTitle,
			Number,
			Date,
			Date_Date,
			StockID,
			StockCode,
			StockTitle,
			StockTitle2,
			DeliverDlID,
			DeliverCode,
			DeliverTitle,
			DeliverTitle2,
			LastEditionDate,
			Version,
			Creator,
			LastEditor,
			CreationDate,
			CreateDateString,
			EditionDateString,
			CreatorUserName,
			EditorName,
			FinancialPeriodID
		)
		as
		(
			SELECT  rtsr.ReturnedTemporaryStockReceiptID ,
							rtsr.StockDocumentTypeBaseEntityID ,
							case @CultureNo
								when 1 then sdt.Title
								when 2 then sdt.Title2
							end as StockDocumentTypeTitle ,
							sdtb.BaseEntity ,
							CASE sdtb.BaseEntity
								WHEN 1 THEN @WithoutBase
								WHEN 4 THEN @TempReceipt
								WHEN 5 THEN @ReturnRequest
							END BaseEntityTitle ,
				rtsr.Number ,
				rtsr.[Date] ,
				CFG.GetCLRSaturnDate(rtsr.[Date], @DateFormat, 0, @DateType) Date_Date,
				rtsr.StockID ,
				s.Code StockCode ,
				s.Title StockTitle ,
				s.Title2 StockTitle2 ,
				rtsr.DeliverDlID ,
				d.Code DeliverCode ,
				d.Title DeliverTitle ,
				d.Title2 DeliverTitle2 ,
				rtsr.LastEditionDate ,
				rtsr.Version ,
				rtsr.Creator ,
				rtsr.LastEditor ,
				rtsr.CreationDate ,
				CFG.GetCLRSaturnDate(rtsr.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
				CFG.GetCLRSaturnDate(rtsr.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
				u.Name AS CreatorUserName ,
				u2.Name AS EditorName ,
				rtsr.FinancialPeriodID
		FROM    STC.ReturnedTemporaryStockReceipt rtsr
				JOIN STC.StockDocumentTypeBaseEntity sdtb ON rtsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				JOIN STF.Stock s ON s.StockID = rtsr.StockID
				JOIN ACC.DL d ON d.DLID = rtsr.DeliverDlID
				JOIN CFG.[User] u ON u.UserID = rtsr.Creator
				JOIN CFG.[User] u2 ON u2.UserID = rtsr.LastEditor
				JOIN cfg.vwStockDocumentsAccess AS vsda ON vsda.StockDocumentTypeID = sdtb.StockDocumentTypeID
				INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = rtsr.StockID
		WHERE rtsr.FinancialPeriodID = @FinancialPeriodID 
			AND ( @UserID = -1 
				OR (@ViewRelatedToUser IS NOT NULL AND rtsr.Creator = @UserID)
				OR (@ViewRelatedToOthers IS NOT NULL AND rtsr.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
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
				@UserID INT,
				@FinancialPeriodID INT,
				@DateType TINYINT ,
				@DateFormat VARCHAR(10),
				@ReturnRequest NVARCHAR(100) ,
				@TempReceipt NVARCHAR(100) ,
				@WithoutBase NVARCHAR(100) ,
				@ViewRelatedToUser INT,
				@ViewRelatedToOthers NVARCHAR(MAX),
			    @CultureNo TINYINT,
				@UnauthorizedUsers NVARCHAR(MAX)
		' ,
                              @UserID = @UserID ,
                              @FinancialPeriodId = @FinancialPeriodId ,
                              @DateFormat = @DateFormat ,
                              @DateType = @DateType ,
                              @ReturnRequest = @ReturnRequest ,
                              @TempReceipt = @TempReceipt ,
                              @WithoutBase = @WithoutBase ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers,
							  @CultureNo = @CultureNo ,
                              @UnauthorizedUsers = @UnauthorizedUsers;

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;

        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);
    END;
