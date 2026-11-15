
--==============================================Alter GetJustificationInputList

CREATE   PROCEDURE [STC].GetJustificationInputList
    (
        @FinancialPeriodID INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @PurchaseRequest NVARCHAR(100) ,
                @Proposal NVARCHAR(100) ,
                @TempReceipt NVARCHAR(100) ,
                @PurchaseContract NVARCHAR(100) ,
                @WithoutBase NVARCHAR(100) ,
                @UserID INT ,
                @DateType TINYINT ,
				@CultureNo tinyint,
                @DateFormat VARCHAR(10),
				@ViewRelatedToUser INT,
				@ViewRelatedToOthers NVARCHAR(MAX),
				@UnauthorizedUsers NVARCHAR(MAX);

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = CFG.GetuserCulture();

        SELECT @WithoutBase = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
               AND L.Item = 'WithOutbase'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @Proposal = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
               AND L.Item = 'Proposal'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @PurchaseRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
               AND L.Item = 'PurchaseRequest'
               AND LV.Culture = CFG.GetuserCulture();

        SELECT @TempReceipt = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
               AND L.Item = 'TemporaryReceipt'
               AND LV.Culture = CFG.GetuserCulture();
        SET @UserID = CFG.GetuserID();

		SELECT @PurchaseContract = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'PurchaseContract'
               AND LV.Culture = CFG.GetuserCulture();

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

        SELECT @ViewRelatedToUser = UserID
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'JustificationInput'
			   AND AccessKey = 'ViewRelatedToUser'
			   AND UserID = @UserID
	
		SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
		FROM   cfg.vwOperationLevelAccess
		WHERE  EntityName = 'JustificationInput'
			   AND AccessKey = 'ViewRelatedToOthers'
			   AND UserID = @UserID

        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
 		WITH Query_Result 
		(
			JustificationInputID,
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
			Version,
			Creator,
			CreatorUserName,
			CreateDateString,
			LastEditor,
			EditorName,
			EditionDateString,
			FinancialPeriodID,
			LastEditionDate,
			CreationDate
		)
		as
		(
			SELECT  ji.JustificationInputID ,
					ji.StockDocumentTypeBaseEntityID ,
					case @CultureNo
						when 1 then sdt.Title
						when 2 then sdt.Title2
					end as StockDocumentTypeTitle ,
					sdtb.BaseEntity ,
					CASE sdtb.BaseEntity
						WHEN 1 THEN @WithoutBase
						WHEN 2 THEN @PurchaseRequest
						WHEN 3 THEN @Proposal
						WHEN 4 THEN @TempReceipt
						WHEN 8 THEN @PurchaseContract
					END
					BaseEntityTitle,
					ji.Number ,
					ji.[Date],
					CFG.GetCLRSaturnDate(ji.[Date],@DateFormat,0,@DateType) Date_Date,
					ji.StockID ,
					s.Code StockCode,
					s.Title StockTitle,
					s.Title2 StockTitle2,
					ji.DeliverDlID ,
					d.Code DeliverCode,
					d.Title DeliverTitle,
					d.Title2 DeliverTitle2,
					ji.Version ,
					ji.Creator ,
					u.Name AS CreatorUserName,
					CFG.GetCLRSaturnDate(ji.CreationDate,@DateFormat,1,@DateType) CreateDateString,
					ji.LastEditor ,
					u2.Name AS EditorName,
					CFG.GetCLRSaturnDate(ji.LastEditionDate,@DateFormat,1,@DateType) EditionDateString,
					ji.FinancialPeriodID,
					ji.LastEditionDate,
					ji.CreationDate
			FROM    STC.JustificationInput ji
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					JOIN STF.Stock s ON s.StockID = ji.StockID
					JOIN ACC.DL d ON d.DLID = ji.DeliverDlID
					JOIN CFG.[User] u ON u.UserID = ji.Creator
					JOIN CFG.[User] u2 ON u2.UserID = ji.LastEditor
					JOIN cfg.vwStockDocumentsAccess AS vsda on sdtb.StockDocumentTypeID=vsda.StockDocumentTypeID
					JOIN cfg.vwStockAccess AS vsa on ji.StockID=vsa.StockID
			WHERE	
					ji.FinancialPeriodID =@FinancialPeriodID
					AND ( @UserID = -1 
							OR (@ViewRelatedToUser IS NOT NULL AND ji.Creator = @UserID)
							OR (@ViewRelatedToOthers IS NOT NULL AND ji.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
				@FinancialPeriodID int,
				@WithoutBase nvarchar(100),
				@PurchaseRequest nvarchar(100),
				@Proposal  nvarchar(100),
				@TempReceipt  nvarchar(100),
				@PurchaseContract  nvarchar(100),
				@ViewRelatedToUser int,
				@ViewRelatedToOthers NVARCHAR(MAX),
				@UnauthorizedUsers NVARCHAR(MAX),
				@DateType TINYINT,
				@DateFormat varchar(10),
			    @CultureNo TINYINT,
				@UserID INT
			' ,
                              @FinancialPeriodID = @FinancialPeriodID ,
                              @WithoutBase = @WithoutBase ,
                              @PurchaseRequest = @PurchaseRequest ,
                              @TempReceipt = @TempReceipt ,
							  @PurchaseContract = @PurchaseContract,
                              @Proposal = @Proposal ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers ,
                              @UnauthorizedUsers = @UnauthorizedUsers ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @DateFormat = @DateFormat ,
                              @DateType = @DateType ,
							  @CultureNo = @CultureNo ,
                              @UserID = @UserID;

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);
    END;
