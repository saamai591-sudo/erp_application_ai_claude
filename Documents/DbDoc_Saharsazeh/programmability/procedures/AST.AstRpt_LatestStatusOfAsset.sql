-------------------------------------
create   proc [AST].AstRpt_LatestStatusOfAsset
(
	@Branches varchar(max) = null,
	@SelectedDlTypes varchar(max) = null,
	@SelectedDeployPlaces varchar(max) = null
)
--WITH ENCRYPTION 
AS
BEGIN

    DROP TABLE IF EXISTS #FilteredDlTypes;
    DROP TABLE IF EXISTS #LatestAssetSettingTemp;

     SELECT * INTO #vwBranchAccess
	 FROM cfg.vwBranchAccess AS vba

		SELECT * INTO #vwStuff
		FROM stf.VWStuff AS v    

    CREATE TABLE #FilteredDlTypes
    (
        DlTypeID INT,
        DlID INT
    );

    IF @SelectedDlTypes IS NOT NULL
       OR @SelectedDlTypes <> ''
    BEGIN
        SELECT @SelectedDlTypes
            = STUFF( (
                    SELECT [CFG].[GetStringPartBySpliter](value, 1, '#') + '#' + 
                            REPLACE([CFG].[GetStringPartBySpliter](value, 2, '#'), ',', ',' + [CFG].[GetStringPartBySpliter](value, 1, '#') + '#' )
                    FROM [CFG].[Split](@SelectedDlTypes, '|')
                    FOR XML PATH(''), TYPE
                ).value('.', 'NVARCHAR(MAX)'),
                1   ,
                0   ,
        '' );

        INSERT INTO #FilteredDlTypes
        SELECT [CFG].[GetStringPartBySpliter](value, 1, '#'),
               [CFG].[GetStringPartBySpliter](value, 2, '#')
        FROM [CFG].[Split](@SelectedDlTypes, ',');
    END;

    SELECT *
    INTO #LatestAssetSettingTemp
    FROM
    (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY AssetID ORDER BY Date DESC) rownum
        FROM AST.AssetSetting
    ) T
    WHERE T.rownum = 1;

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            ELSE
                                2
                        END;


    SELECT @DateFormat = UPPER(us.SettingValue)
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    DECLARE @UsedDlType NVARCHAR(MAX),
            @SelectDlType NVARCHAR(MAX);

    SELECT @UsedDlType = STUFF(
    (
        SELECT ',' + QUOTENAME(DlTypeID)
        FROM ACC.UsedDlType
        WHERE SaturnModuleID = 14
        GROUP BY DlTypeID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                              );
    IF @UsedDlType IS NULL
        SET @UsedDlType = N'[-1]';

    SELECT @SelectDlType = STUFF(
    (
        SELECT ',piv.' + QUOTENAME(DlTypeID) + ' AS T' + CAST(DlTypeID AS VARCHAR(25))
        FROM ACC.UsedDlType
        WHERE SaturnModuleID = 14
        GROUP BY DlTypeID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
                                );

    IF @SelectDlType IS NULL
        SET @SelectDlType = N'';

    DECLARE @query NVARCHAR(MAX);

    SET @query
        = N'SELECT a.AssetID, a.Plaque,
       CASE
           WHEN @CultureNo = 1 THEN
               a.Title
           WHEN @CultureNo = 2 THEN
               a.Title2
       END AS Title,
       ast.Date,
       CFG.GetCLRSaturnDate(ast.Date, @DateFormat, 0, @DateType) AS Date_Date,
       CASE
           WHEN @CultureNo = 1 THEN
               p1.Title + '' '' + ISNULL(p1.LastName, '''')
           WHEN @CultureNo = 2 THEN
               p1.Title2 + '' '' + ISNULL(p1.LastName2, '''')
       END AS Responsible,
       CASE
           WHEN @CultureNo = 1 THEN
               p2.Title + '' '' + ISNULL(p2.LastName, '''')
           WHEN @CultureNo = 2 THEN
               p2.Title2 + '' '' + ISNULL(p2.LastName2, '''')
       END AS Deliverer,
       [AST].[DeployPlaceFullTitle](ast.DeployPlaceID) DeployPlace,
       CASE
           WHEN a.Status = 1 AND ast.Status = 1 THEN
               N''در حال استفاده''
           WHEN a.Status = 1 AND ast.Status = 2 THEN
               N''بلااستفاده''
           WHEN a.Status = 2 THEN
               N''خارج شده''
           WHEN a.Status = 3 THEN
               N''فروش رفته''
           WHEN a.Status = 4 THEN
               N''اسقاط شده''
           WHEN a.Status = 5 THEN
               N''احیاء شده''
           WHEN a.Status = 6 THEN
               N''اهداء شده''
           WHEN a.Status = 7 THEN
               N''منتقل شده''
       END [Status],
	   CASE
           WHEN a.Status = 1 AND ast.Status = 1 THEN
              CFG.GetCLRSaturnDate(a.[AssetCreationDate], @DateFormat, 0, @DateType) 
           WHEN a.Status = 6 THEN
              CFG.GetCLRSaturnDate(gift.[Date], @DateFormat, 0, @DateType) 
           WHEN a.Status = 3 THEN
              CFG.GetCLRSaturnDate(sale.[Date], @DateFormat, 0, @DateType) 
           WHEN a.Status = 2 THEN
              CFG.GetCLRSaturnDate(Destruction.[Date], @DateFormat, 0, @DateType) 
           WHEN a.Status = 4 THEN
              CFG.GetCLRSaturnDate(Salvage.[Date], @DateFormat, 0, @DateType) 
           WHEN a.Status = 7 THEN
              CFG.GetCLRSaturnDate(Transfer.[Date], @DateFormat, 0, @DateType) 
			ELSE NULL
       END StatusDate,
       CASE
           WHEN a.Nature = 1 THEN
               N''استقرار''
           WHEN a.Nature = 3 THEN
               N''دریافت از شعبه''
           ELSE N''عملیاتی''
       END Nature,
       CASE  WHEN a.AssetType = 1 THEN
               N''دارایی ثابت''
           WHEN a.AssetType = 2 THEN
               N''دارایی نامشهود''
           WHEN a.AssetType = 3 THEN
               N''سایر دارائیها''
       END AssetType,
       NULL AS OutgoingNumber,
       ISNULL(ac.ParentCode, '''') + ac.Code AS AssetCategoryCode,
       CASE WHEN @CultureNo = 1 THEN
               ac.Title
           WHEN @CultureNo = 2 THEN
               ac.Title2
       END AS AssetCategoryTitle,
       stf.code StuffCode
	    ' + @SelectDlType
          + N'
FROM #LatestAssetSettingTemp ast
    JOIN AST.Asset a ON a.AssetID = ast.AssetID
	LEFT JOIN  (
		select si.AssetID, s.Date, s.Type  from AST.SaleItem si
		join AST.Sale s on s.SaleID = si.SaleID
		WHERE s.Type = 1
	) sale on sale.AssetID = a.AssetID
	LEFT JOIN (select si.AssetID, s.Date, s.Type  from AST.SaleItem si
		join AST.Sale s on s.SaleID = si.SaleID
		WHERE s.Type = 2
	) gift on gift.AssetID = a.AssetID
	LEFT JOIN (select ti.AssetID, t.Date from ast.destruction t
		join ast.DestructionItem ti on t.destructionID = ti.destructionID
	) Destruction on Destruction.AssetID = a.AssetID
	LEFT JOIN (select ti.AssetID, t.Date from ast.Salvage t
		join ast.SalvageItem ti on t.SalvageID = ti.SalvageID
	) Salvage on Salvage.AssetID = a.AssetID
	LEFT JOIN (select ti.AssetID, t.Date from ast.Transfer t
		join ast.TransferItem ti on t.TransferID = ti.TransferID
	) Transfer on Transfer.AssetID = a.AssetID
    LEFT JOIN AST.AssetCategory ac ON a.AssetCategoryID = ac.AssetCategoryID
    LEFT JOIN CFG.Party p1 ON p1.PartyID = ast.Responsible
    LEFT JOIN CFG.Party p2 ON p2.PartyID = ast.Deliverer
    INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = a.BranchID
    LEFT JOIN #VWStuff stf ON stf.StuffID = a.StuffID
	LEFT JOIN ( select AssetSettingID, a.DlTypeID,
		   case when @CultureNo = 1 then b.Title else  b.Title2 end Value
	from ast.AssetSettingDl a
		join acc.dl b on a.dlid = b.dlid
	)X
	pivot
	( max(value) for DlTypeID in (' + @UsedDlType
          + N')
	)piv on piv.AssetSettingID = ast.AssetSettingID		
WHERE (
          @Branches IS NULL
          OR a.BranchID IN ( SELECT value FROM CFG.R_FnCommaStr2Table(@Branches) )
      )
      AND
      (   @SelectedDlTypes IS NULL
          OR ast.AssetSettingID IN
             (		SELECT DISTINCT AssetSettingID FROM AST.AssetSettingDl
					WHERE DlTypeID IN ( SELECT DISTINCT DlTypeID FROM #FilteredDlTypes)
                       AND DlID IN ( SELECT DISTINCT DlID FROM #FilteredDlTypes ))
      )
      AND
      ( @SelectedDeployPlaces IS NULL
          OR ast.DeployPlaceID IN ( SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedDeployPlaces) )
      )
	  ';

    PRINT @query;

    EXEC sys.sp_executesql @query,
                           N'@Branches					nvarchar(max),
	  @SelectedDlTypes			nvarchar(max),
	  @SelectedDeployPlaces		nvarchar(max),
	  @CultureNo				tinyint,
	  @DateFormat				varchar(10),
	  @DateType					tinyint
	  ',
                           @Branches = @Branches,
                           @SelectedDlTypes = @SelectedDlTypes,
                           @SelectedDeployPlaces = @SelectedDeployPlaces,
                           @CultureNo = @CultureNo,
                           @DateFormat = @DateFormat,
                           @DateType = @DateType;

END;

