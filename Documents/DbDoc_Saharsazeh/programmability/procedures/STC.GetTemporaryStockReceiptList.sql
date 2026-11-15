
-----------------------------------------
CREATE   PROCEDURE [STC].GetTemporaryStockReceiptList
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
				@WithoutBase NVARCHAR(100) ,
				@UserID INT ,
				@DateType TINYINT ,
				@DateFormat VARCHAR(10),
				@PurchaseContract NVARCHAR(100),
				@PurchaseInvoice NVARCHAR(100),
				@DeliveryJustification NVARCHAR(100),
				@CultureNo tinyint,
				@Contract NVARCHAR(100);
				
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

		SELECT @Contract = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
			   AND L.Item = 'Contract'
			   AND LV.Culture = CFG.GetuserCulture();

		SELECT @PurchaseContract = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
			   AND L.Item = 'PurchaseContract'
			   AND LV.Culture = CFG.GetuserCulture();

		SELECT @PurchaseInvoice = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
			   AND L.Item = 'PurchaseInvoice'
			   AND LV.Culture = CFG.GetuserCulture();

		SELECT @DeliveryJustification = LV.Value
		FROM   CFG.LocalizeEnum L
			   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
		WHERE  L.Enum = 'TemporaryStockReceiptBaseType'
			   AND L.Item = 'DeliveryJustification'
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
				@UnauthorizedUsers NVARCHAR(MAX);
						
		SELECT @ViewRelatedToUser = UserID
		FROM CFG.vwOperationLevelAccess
		WHERE EntityName = 'TemporaryStockReceipt'
			  AND AccessKey = 'ViewRelatedToUser'
			  AND UserID = @UserID;

		SELECT @ViewRelatedToOthers = UserID ,
			   @UnauthorizedUsers = Users
		FROM CFG.vwOperationLevelAccess
		WHERE EntityName = 'TemporaryStockReceipt'
			  AND AccessKey = 'ViewRelatedToOthers'
			  AND UserID = @UserID;
	   
		DECLARE @Query NVARCHAR(MAX);
		SET @Query = '
				WITH Query_Result 
				(
					TemporaryStockReceiptID,
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
					CreationDate,
					CreateDateString,
					LastEditor,
					LastEditionDate,
					EditionDateString,
					CreatorUserName,
					EditorName,
					FinancialPeriodID
				)
				AS
				(
					SELECT  tsr.TemporaryStockReceiptID ,
							tsr.StockDocumentTypeBaseEntityID ,
							case @CultureNo
								when 1 then sdt.Title
								when 2 then sdt.Title2
							end as StockDocumentTypeTitle ,
							sdtb.BaseEntity ,
							CASE sdtb.BaseEntity
								WHEN 1 THEN @WithoutBase
								WHEN 2 THEN @PurchaseRequest
								WHEN 3 THEN @Proposal
								WHEN 7 THEN @PurchaseInvoice
								WHEN 8 THEN @PurchaseContract
								When 11 THEN @Contract
								WHEN 15 THEN @DeliveryJustification
							END BaseEntityTitle ,
							tsr.Number ,
							tsr.[Date] ,
							CFG.GetCLRSaturnDate(tsr.[Date], @DateFormat, 0, @DateType) Date_Date ,
							tsr.StockID ,
							s.Code StockCode ,
							s.Title StockTitle ,
							s.Title2 StockTitle2 ,
							tsr.DeliverDlID ,
							d.Code AS DeliverCode ,
							d.Title DeliverTitle ,
							d.Title2 DeliverTitle2,
							tsr.[Version] ,
							tsr.Creator ,
							tsr.CreationDate ,
							CFG.GetCLRSaturnDate(tsr.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
							tsr.LastEditor ,
							tsr.LastEditionDate ,
							CFG.GetCLRSaturnDate(tsr.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString ,
							u.Name AS CreatorUserName ,
							u2.Name AS EditorName ,
							tsr.FinancialPeriodID
				FROM    STC.TemporaryStockReceipt tsr
						JOIN STC.StockDocumentTypeBaseEntity sdtb
								ON tsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						JOIN STC.StockDocumentType sdt 
								ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
						JOIN STF.Stock s 
								ON s.StockID = tsr.StockID
						LEFT JOIN ACC.DL d 
								ON d.DLID = tsr.DeliverDlID
						JOIN CFG.[User] u 
								ON u.UserID = tsr.Creator
						JOIN CFG.[User] u2 
								ON u2.UserID = tsr.LastEditor 
						JOIN cfg.vwStockDocumentsAccess AS vsda 
								ON vsda.StockDocumentTypeID = sdtb.StockDocumentTypeID
						INNER JOIN cfg.vwStockAccess AS vsa 
								ON vsa.StockID = tsr.StockID
				WHERE tsr.FinancialPeriodID = @FinancialPeriodID 
					AND ( @UserID = -1 
						OR (@ViewRelatedToUser IS NOT NULL AND tsr.Creator = @UserID)
						OR (@ViewRelatedToOthers IS NOT NULL AND tsr.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
					)
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
			  @UserID INT,
			  @FinancialPeriodID INT,
			  @DateType TINYINT ,
			  @DateFormat VARCHAR(10),
			  @PurchaseRequest NVARCHAR(100) ,
			  @Proposal NVARCHAR(100) ,
			  @WithoutBase NVARCHAR(100) ,
			  @ViewRelatedToUser INT,
			  @ViewRelatedToOthers NVARCHAR(MAX),
			  @UnauthorizedUsers NVARCHAR(MAX),
			  @PurchaseContract NVARCHAR(100),
			  @PurchaseInvoice NVARCHAR(100),
			  @DeliveryJustification NVARCHAR(100),
			  @CultureNo tinyint,
			  @Contract NVARCHAR(100)
		' ,
							  @UserID = @UserID ,
							  @FinancialPeriodID = @FinancialPeriodID ,
							  @DateFormat = @DateFormat ,
							  @DateType = @DateType ,
							  @PurchaseRequest = @PurchaseRequest ,
							  @Proposal = @Proposal ,
							  @WithoutBase = @WithoutBase ,
							  @ViewRelatedToOthers = @ViewRelatedToOthers ,
							  @UnauthorizedUsers = @UnauthorizedUsers ,
							  @ViewRelatedToUser = @ViewRelatedToUser,
							  @PurchaseContract = @PurchaseContract,
							  @PurchaseInvoice = @PurchaseInvoice,
							  @DeliveryJustification = @DeliveryJustification,
							  @CultureNo = @CultureNo ,
							  @Contract = @Contract

		DECLARE @Count INT;

		EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

		SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
		EXECUTE sp_executesql @Query ,
							  N'@count int out' ,
							  @Count = @Count OUT;

		RETURN ISNULL(@Count, 0);
	END;
