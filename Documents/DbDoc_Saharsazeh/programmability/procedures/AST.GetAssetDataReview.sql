-------------------------------------
create      PROCEDURE [AST].[GetAssetDataReview]
    (
	  @AssetReceiptID int = null,
	  @EngName nvarchar(25)
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
			@DateType TINYINT ,
			@DateFormat VARCHAR(10) ,
			@Culture VARCHAR(25) ,
			@FixAsset NVARCHAR(100) ,
			@UnSensibleAsset NVARCHAR(100) ,
			@OtherAsset NVARCHAR(100) ,
			@Ascending NVARCHAR(100) ,
			@Direct NVARCHAR(100) ,
			@WithoutDepreciation NVARCHAR(100) ,
			@InProgress NVARCHAR(100) ,
			@Destructed NVARCHAR(100) ,
			@Saled NVARCHAR(100) ,
			@Salvaged NVARCHAR(100) ,
			@Revival NVARCHAR(100) ,
			@Gift NVARCHAR(100),
			@CultureNo tinyint
	
	SELECT * into #vwEnum 
	FROM   cfg.VwEnums AS ve
	WHERE ve.Enum IN('DepreciationMethod')

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
    SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID;
	
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                          WHEN 'fa' THEN 0
                          WHEN 'en' THEN 1
                          WHEN 'ar' THEN 2
                        END;
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID;
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';
	
    SELECT  @FixAsset = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetType'
            AND L.Item = 'FixAsset'
            AND LV.Culture = @Culture;

    SELECT  @UnSensibleAsset = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetType'
            AND L.Item = 'UnSensibleAsset'
            AND LV.Culture = @Culture;

    SELECT  @OtherAsset = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetType'
            AND L.Item = 'OtherAsset'
            AND LV.Culture = @Culture;

    SELECT  @InProgress = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'InProgress'
            AND LV.Culture = @Culture;

    SELECT  @Destructed = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'Destructed'
            AND LV.Culture = @Culture;

    SELECT  @Saled = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'Saled'
            AND LV.Culture = @Culture;

    SELECT  @Salvaged = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'Salvaged'
            AND LV.Culture = @Culture;

    SELECT  @Revival = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'Revival'
            AND LV.Culture = @Culture;

    SELECT  @Gift = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'AssetStatus'
            AND L.Item = 'Gift'
            AND LV.Culture = @Culture;

		 SELECT * INTO #vwBranchAccess
	 FROM cfg.vwBranchAccess AS vba

	select a.AssetCategoryID,
	       isnull(a.ParentCode,'')+a.Code AssetCategoryCode,
		   case @CultureNo
				when 2 then a.Title2
				else a.Title 
		   end as AssetCategoryTitle
	into #Categories
	from AST.AssetCategory a
	where a.[Level] = (select ConfigValue from CFG.Configuration where ConfigKey='AssetCategoryLevelsCount')


	select * 
	into #Changes
	from (select ROW_NUMBER() over(partition by AssetID order by Date desc) Rno,AssetID,OldPlauqe
		  from AST.ChangePlauqe
		 ) T where T.Rno = 1


	select * 
	into #LastAssetSetting 
	from (select ROW_NUMBER() over(partition by s.AssetID order by s.[Date] desc) Rno,
				s.AssetID,a.BranchID
	      from AST.AssetSetting s
		  join AST.Asset a on s.AssetID = a.AssetID
		 ) T 
	where T.Rno = 1


			SELECT a.AssetID,
				   a.Plaque,
				   case @CultureNo
					    when 2 then a.Title2
	                    else a.Title
	               end as Title,
				   b.Code BranchCode,
				   case @CultureNo
					    when 2 then b.Title2 
	                    else b.Title
	               end as BranchName,
				   ar.Number,
				   ar.Date as Date,
				   CFG.GetCLRSaturnDate(ar.Date,@DateFormat  ,0,@DateType) AS Date_Date,					   
				   CASE WHEN a.AssetType = 1 THEN @FixAsset
					    WHEN a.AssetType = 2 THEN @UnSensibleAsset
					    WHEN a.AssetType = 3 THEN @OtherAsset END AS AssetTypeString,
				   a.BaseValue,
				   a.AccumulatedDepreciation,
				   a.SalvageValue,				   
				   ca.AssetCategoryCode,				   
				   ca.AssetCategoryTitle,				   			   
				   ve.Value AS DepreciationMethodString,
				   a.DepreciationRate,
				   case when a.Status = 1 then @InProgress
					    when a.Status = 2 then @Destructed
					    when a.Status = 3 then @Saled
					    when a.Status = 4 then @Salvaged
					    when a.Status = 5 then @Revival
					    when a.Status = 6 then @Gift
				   END StatusString,
				   ch.OldPlauqe,
				   CFG.GetCLRSaturnDate(a.CreationDate,@DateFormat,1,@DateType) AS CreateDateString,
				   CFG.GetCLRSaturnDate(a.LastEditionDate,@DateFormat,1,@DateType) AS EditionDateString , 	   	   
				   u1.[Name] CreatorUserName,
				   u2.[Name] EditorName
		
			FROM AST.Asset a
			JOIN CFG.Branch b on a.BranchID = b.BranchID
			left JOIN #Categories ca ON ca.AssetCategoryID = a.AssetCategoryID
			LEFT join #vwEnum ve on a.DepreciationMethod = ve.KeyValue and ve.Enum= 'DepreciationMethod'
			JOIN CFG.[User] u1 ON a.Creator = u1.UserID
			JOIN CFG.[User] u2 ON a.LastEditor = u2.UserID
			left join #Changes ch on ch.AssetID = a.AssetID
			join #LastAssetSetting la on la.AssetID = a.AssetID
			JOIN #vwBranchAccess AS vba ON a.BranchID=vba.BranchID AND vba.UserID=@UserID
			where (@AssetReceiptID is null or a.AssetReceiptID = @AssetReceiptID)
			
