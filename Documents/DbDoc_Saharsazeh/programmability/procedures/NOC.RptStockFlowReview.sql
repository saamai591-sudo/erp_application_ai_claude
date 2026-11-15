
----------------------------------------------------
CREATE   PROC [NOC].[RptStockFlowReview]
(
    @FromPeriod int,
    @ToPeriod int,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedDelivers NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE 
            @tableName NVARCHAR(20),
            @query NVARCHAR(MAX),
            @Culture VARCHAR(25),
			@UserID INT,
            @CultureNo CHAR(1),
            @DateType NVARCHAR(10),
            @DateFormat NVARCHAR(10);

    SET @tableName = CFG.getTempTableName(1);

	exec [NOC].[RptDollarCartexDataSource] 
										@FromPeriod,
										@ToPeriod,
										@tableName,
										@SelectedStuffs,
										@SelectedStocks,
										@SelectedStuffTrace,
										@SelectedStuffAccountGroup,
										@SelectedStuffGroup
	
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
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

	--- Translation
	begin
		DECLARE @Receipt NVARCHAR(100),
				@ReturnReceipt NVARCHAR(100),
				@Outgoing NVARCHAR(100),
				@ReturnedOutgoing NVARCHAR(100),
				@StuffRequest NVARCHAR(100),
				@Ingredients NVARCHAR(100),
                @SemiManufacturedStuff NVARCHAR(100),
                @Product NVARCHAR(100),
			    @FixedAssets  NVARCHAR(100),
			    @OtherStuffs NVARCHAR(100)
			    
		SELECT @Receipt = N'''' + lev.[Value] + N''''
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'DocumentNumTypes'
			  AND le.Item = 'StockReceipt'
			  AND lev.Culture = @Culture;

		SELECT @ReturnReceipt = N'''' + lev.[Value] + N''''
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'DocumentNumTypes'
			  AND le.Item = 'ReturnStockReceipt'
			  AND lev.Culture = @Culture;

		SELECT @Outgoing = N'''' + lev.[Value] + N''''
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'DocumentNumTypes'
			  AND le.Item = 'Outgoing'
			  AND lev.Culture = @Culture;

		SELECT @ReturnedOutgoing = N'''' + lev.[Value] + N''''
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'DocumentNumTypes'
			  AND le.Item = 'ReturnedOutgoing'
			  AND lev.Culture = @Culture;


		SELECT @StuffRequest = N'''' + lev.[Value] + N''''
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'DocumentNumTypes'
			  AND le.Item = 'StuffRequest'
			  AND lev.Culture = @Culture;


    SELECT @Ingredients = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StuffDetailTypes'
          AND le.Item = 'Ingredients'
          AND lev.Culture = @Culture;

    SELECT @SemiManufacturedStuff = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StuffDetailTypes'
          AND le.Item = 'SemiManufacturedStuff'
          AND lev.Culture = @Culture;

    SELECT @Product = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StuffDetailTypes'
          AND le.Item = 'Product'
          AND lev.Culture = @Culture;

    SELECT @FixedAssets = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StuffDetailTypes'
          AND le.Item = 'FixedAssets'
          AND lev.Culture = @Culture;

    SELECT @OtherStuffs = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'StuffDetailTypes'
          AND le.Item = 'OtherStuffs'
          AND lev.Culture = @Culture;

	end

	DECLARE @Columns NVARCHAR(MAX),
			@CodeAndTitleColumn NVARCHAR(MAX),
			@LeftJoin NVARCHAR(MAX)

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',ii.' + QUOTENAME(TraceID) +' AS T' + CAST(TraceID AS VARCHAR(10))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT DISTINCT
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [T' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF (@CodeAndTitleColumn IS NULL)
        SET @CodeAndTitleColumn = N'';


    SELECT @LeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = ii.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF (@LeftJoin IS NULL)
        SET @LeftJoin = N'';

    DECLARE @listLeftJoin NVARCHAR(MAX);
    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = A.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

    IF (@listLeftJoin IS NULL)
        SET @listLeftJoin = N'';


	select *
	into #VwStuff
	from stf.VWStuff
	where type = 0
	
	select * 
	into #VWVoucherPrevoucher
	from acc.VWVoucherPrevoucher
	where EngName in ('StockReceipt','ReturnStockReceipt','Outgoing','ReturnedOutgoing')

    SET @query
        = N'select  ROW_NUMBER() over (order by ii.Date,ii.DocType,ii.Number) ResItemID,
						case Nature when 1 then N''اصلی''
									when 2 then N''اصلاح فی تمام شده''
									when 3 then N''تعدیلات نرخ ارز''
								end Nature,
						ii.RowIndex,
						case EntityName when ''StockReceipt'' then N' + @Receipt + N' 
										when ''ReturnStockReceipt'' then N' + @ReturnReceipt + N' 
										when ''Outgoing'' then N' + @Outgoing + N' 
										when ''ReturnedOutgoing'' then N' + @ReturnedOutgoing + N' 
							end DocName,
						ii.[Description],
						ii.DocType,
						ii.HeaderID,
						ii.ItemId,
						ii.Number,
						ii.Type,
						ii.DocumentType,
						v.ReferenceNumber,
						v.[Date] VoucherDate,
						CFG.GetCLRSaturnDate(v.[Date],''' + @DateFormat + N'''  , 0,''' + @DateType + N''') Voucher_Date,	
						case when @CultureNo = 1 then stf.MainMeasureUnit else stf.MainMeasureUnit2 end as MainMeasureUnit,		
						case when @CultureNo = 1 then stf.SubMeasureUnit else stf.SubMeasureUnit2 end as SubMeasureUnit,
						ii.[Date],
						CFG.GetCLRSaturnDate(ii.[Date],''' + @DateFormat + N'''  , 0,''' + @DateType + N''') Date_Date,		
						case when @CultureNo = 1 then stf.Title else stf.Title2 end as StuffTitle,
						stf.Code StuffCode,
						case when @CultureNo = 1 then stf.StuffAccountGroupTitle else stf.StuffAccountGroupTitle2 end as AccountGroup,
						case when stf.StuffDetailType = 0 then N' + @Ingredients + N' 
							 when stf.StuffDetailType = 1 then N' + @SemiManufacturedStuff + N' 
							 when stf.StuffDetailType = 2 then N' + @Product + N'
							 when stf.StuffDetailType = 4 then N' + @FixedAssets + N' 
							 when stf.StuffDetailType = 5 then N' + @OtherStuffs + N' 
						 else null end as StuffType,
						stc.Code as StockCode,
						case when @CultureNo = 1 then stc.Title else stc.Title2 end as StockTitle,
						case when DeliverDlID is NULL then cast(stcd.Code  as nvarchar(255)) else cast( dl.Code   as nvarchar(255)) end as DeliverCode,
						case when DeliverDlID is null  then stcd.Title else dl.Title end as DeliverTitle , 
						' + @Columns + N',
						ii.MainQuantity,ii.SubQuantity,
						ii.BaseCurrencyPrice,
						ii.ReportCurrencyRate,
						ii.Price
						' + @CodeAndTitleColumn + N'
                    FROM   '+@tableName+' ii 
					INNER JOIN #VwStuff stf on stf.StuffID = ii.StuffID
					left join STF.Stock stcd on stcd.StockID = ii.DeliverStockID 
					left join ACC.DL dl on dl.DLID = ii.DeliverDlID 
					left join STF.Stock stc on ii.StockID = stc.StockID
					left join #VWVoucherPrevoucher v on v.prevoucherid = ii.prevoucherid ' 
					+ @LeftJoin + N' ' + @listLeftJoin 

    EXEC sp_executesql    @query,
                          N'@CultureNo AS CHAR(1)',
                          @CultureNo = @CultureNo;
END;
