
CREATE    PROCEDURE [AST].GetAssetList
(
	@AssetReceiptID INT,
	@EngName        NVARCHAR(25),
	@PageNumber     INT,
	@RowspPage      INT,
	@Sort           NVARCHAR(MAX) = NULL,
	@Filter         NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	PRINT 1
	DECLARE @UserID                  INT,
			@DateType                TINYINT,
			@DateFormat              VARCHAR(10),
			@ViewRelatedToUser       INT,
			@ViewRelatedToOthers     NVARCHAR(MAX),
			@Culture                 VARCHAR(25),
			@CultureNo               TINYINT,
		    @UnauthorizedUsers      NVARCHAR(MAX);
		
	SELECT * into #vwEnum 
	FROM   cfg.VwEnums AS ve
	WHERE ve.Enum IN( 'DepreciationMethod','AssetType','AssetNatures','AssetStatus','AssetAccountingStatus')
		
	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
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
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID,
		   @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	SELECT @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
		
	SELECT a.AssetCategoryID,
		   ISNULL(a.ParentCode, '') + a.Code AssetCategoryCode,
		   CASE @CultureNo
				WHEN 2 THEN a.Title2
				ELSE a.Title
		   END  AS AssetCategoryTitle
	INTO   #Categories
	FROM   AST.AssetCategory a
	WHERE  a.[Level] = (
			   SELECT ConfigValue
			   FROM   CFG.Configuration
			   WHERE  ConfigKey = 'AssetCategoryLevelsCount'
		   )	
	
	SELECT *
	INTO   #Changes
	FROM   (
			   SELECT ROW_NUMBER() OVER(PARTITION BY AssetID ORDER BY DATE DESC) Rno,
					  AssetID,
					  OldPlauqe
			   FROM   AST.ChangePlauqe
		   ) T
	WHERE  T.Rno = 1
	
	
	SELECT *
	INTO   #LastAssetSetting
	FROM   (
			   SELECT ROW_NUMBER() OVER(PARTITION BY s.AssetID ORDER BY s.[Date] DESC) Rno,
					  s.AssetID,
					  c.BranchID
			   FROM   AST.AssetSetting s
					  JOIN AST.Asset a
						   ON  s.AssetID = a.AssetID
					  LEFT JOIN AST.Creation c
						   ON  a.CreationID = c.CreationID
		   ) T
	WHERE  T.Rno = 1
	
	
	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Number desc';
	
	SELECT * INTO #vwBranchAccess
	  FROM cfg.vwBranchAccess AS vba
	
	DECLARE @Query NVARCHAR(MAX);    
	SET @Query = 
		'WITH Query_Result 			
			AS (
			SELECT a.AssetID,
				   a.CreationID,				   
				   a.AssetReceiptID,

				   ar.Number As AssetReceiptNumber,
				   ar.Date As AssetReceiptDate,				   
				   CFG.GetCLRSaturnDate(ar.Date,@DateFormat,0,@DateType) AS AssetReceiptDate_Date,

				   rfb.Number As ReceivedFromBranchNumber,
				   rfb.Date As ReceivedFromBranchDate,				   
				   CFG.GetCLRSaturnDate(rfb.Date,@DateFormat,0,@DateType) AS ReceivedFromBranchDate_Date,

				   a.UtilizationDate,
				   CFG.GetCLRSaturnDate(a.UtilizationDate,@DateFormat,0,@DateType) AS UtilizationDate_Date,
				   a.AssetCreationDate,
				   CFG.GetCLRSaturnDate(a.AssetCreationDate,@DateFormat,0,@DateType) AS AssetCreationDate_Date,
				   a.Plaque,
				   case ' + CAST(@CultureNo AS CHAR(1)) + 
		'
						when 2 then a.Title2
						else a.Title
				   end as Title,
				   b.Code BranchCode,
				   case ' + CAST(@CultureNo AS CHAR(1)) + 
		'
						when 2 then b.Title2 
						else b.Title
				   end as BranchName,
				   c.Number,
				   c.date as Date,
				   CFG.GetCLRSaturnDate(c.Date,@DateFormat  ,0,@DateType) AS Date_Date,		
				   a.BaseValue,
				   a.AccumulatedDepreciation,
				   a.SalvageValue,				   
				   ca.AssetCategoryCode,				   
				   ca.AssetCategoryTitle,	
				   a.Nature,
				   vean.Value AS NatureString,
				   vea.Value AS AssetTypeString,
				   ve.Value AS DepreciationMethodString,
				   a.DepreciationRate,
				   a.AccountingStatus,
				   veac.Value AS AccountingStatusString,
				   veas.Value AS StatusString,
				   o.Number OutgoingNumber,
				   ch.OldPlauqe,
				   a.CreationDate,
				   a.LastEditionDate,
				   CFG.GetCLRSaturnDate(a.CreationDate,@DateFormat,1,@DateType) AS CreateDateString,
				   CFG.GetCLRSaturnDate(a.LastEditionDate,@DateFormat,1,@DateType) AS EditionDateString , 	   	   
				   u1.[Name] CreatorUserName,
				   u2.[Name] EditorName		
			FROM AST.Asset a			
			LEFT JOIN AST.Creation c ON c.CreationID = a.CreationID
			LEFT JOIN AST.AssetReceipt ar ON ar.AssetReceiptID = a.AssetReceiptID
			LEFT JOIN ast.ReceivedFromBranchItem rfbi on rfbi.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
			LEFT JOIN ast.ReceivedFromBranch rfb on rfb.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
			JOIN CFG.Branch b on a.BranchID = b.BranchID
			LEFT JOIN #Categories ca ON ca.AssetCategoryID = a.AssetCategoryID 
			LEFT join #vwEnum veas on a.Status = veas.KeyValue and veas.Enum= ''AssetStatus''
			LEFT JOIN #vwEnum veac ON a.AccountingStatus = veac.KeyValue AND veac.Enum = ''AssetAccountingStatus''
			LEFT join #vwEnum vean on a.Nature = vean.KeyValue and vean.Enum= ''AssetNatures''
			LEFT join #vwEnum vea on a.AssetType = vea.KeyValue and vea.Enum= ''AssetType''
			LEFT join #vwEnum ve on a.DepreciationMethod = ve.KeyValue and ve.Enum= ''DepreciationMethod''
			JOIN CFG.[User] u1 ON a.Creator = u1.UserID
			JOIN CFG.[User] u2 ON a.LastEditor = u2.UserID
			LEFT join stc.OutgoingItem oi on oi.OutgoingItemID = c.OutgoingItemID
			LEFT join stc.Outgoing o on o.OutgoingID = oi.OutgoingID
			LEFT join #Changes ch on ch.AssetID = a.AssetID
			LEFT join #LastAssetSetting la on la.AssetID = a.AssetID
			INNER JOIN #vwBranchAccess AS vba on vba.BranchID=a.BranchID
			where   
			    (isnull(@AssetReceiptID,0) = 0 or a.AssetReceiptID = @AssetReceiptID)
				and ( @UserID = -1 
						or  (@ViewRelatedToUser is not null and a.Creator = @UserID)
						or  (@ViewRelatedToOthers is not null and a.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
					)
					)
			)'
	
	DECLARE @selectQuery NVARCHAR(MAX);
	
	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = '';
	ELSE
	SET @Filter = 'Where (' + @Filter + ')';
	
	
	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);
	
	
	
	SET @Query = CFG.ApplyPaging(
			@tableName,
			@Query,
			@PageNumber,
			@RowspPage,
			@Filter,
			@Sort
		);
	PRINT @Query
	
	EXECUTE sp_executesql @Query,
		 N'@AssetReceiptID int,@UserID int,@DateType tinyint,@DateFormat varchar(10),@ViewRelatedToUser int,@ViewRelatedToOthers NVARCHAR(MAX),@Culture varchar(25),
		 @CultureNo tinyint,@UnauthorizedUsers NVARCHAR(MAX)',
		 @AssetReceiptID = @AssetReceiptID,
		 @UserID = @UserID,
		 @DateType = @DateType,
		 @DateFormat = @DateFormat,
		 @ViewRelatedToUser = @ViewRelatedToUser,
		 @ViewRelatedToOthers = @ViewRelatedToOthers,
		 @Culture = @Culture,
		 @CultureNo = @CultureNo,
		 @UnauthorizedUsers = @UnauthorizedUsers
	
	DECLARE @Count INT;
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName; 
	EXECUTE sp_executesql @Query,
		 N'@count int out',
		 @Count = @Count OUT;
	
	RETURN ISNULL(@Count, 0)

