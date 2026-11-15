
CREATE   PROCEDURE [SLE].GetNonReturnedSaleJustification
(
	@date DATE,
	@ids NVARCHAR(MAX) = NULL,
	@dlId INT,
	@saleTypeId INT = NULL,
	@StuffID INT = NULL,
	@saleAreaId INT = NULL
)
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @SelectColumns NVARCHAR(MAX),
			@UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture VARCHAR(10),
			@DynamicColumns NVARCHAR(MAX),
			@CodeAndTitleColumn NVARCHAR(MAX),
			@LeftJoin NVARCHAR(MAX),
			@query NVARCHAR(MAX),
			@CultureNo TINYINT;

	IF (@ids = '')
		SET @ids = NULL;

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

	SELECT @DynamicColumns = STUFF(
	(
		SELECT DISTINCT
			   ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
		FROM STF.Trace
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
								  );

	IF (@DynamicColumns IS NULL)
		SET @DynamicColumns = N'[-1]';

	SELECT @SelectColumns
		= STUFF(
	(
		SELECT DISTINCT
			   CASE
				   WHEN AccountLevelTypeID <> 5 THEN
					   ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
					   + CASE AccountLevelTypeID
							 WHEN 6 THEN
								 ',tri' + CAST(TraceID AS VARCHAR(5)) + '.Item' + CASE @CultureNo
																					  WHEN 2 THEN
																						  '2'
																					  ELSE
																						  ''
																				  END + ' AS TRCode'
								 + CAST(TraceID AS VARCHAR(5))
							 ELSE
								 ''
						 END
				   ELSE
					   ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
					   + ',CFG.GetCLRSaturnDate(Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
					   + ', @DateFormat, 0, @DateType) AS TRDate' + CAST(TraceID AS VARCHAR(5))
			   END
		FROM STF.Trace
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
			   );

	IF (@SelectColumns IS NULL)
		SET @SelectColumns = N'[-1]';

	SELECT @CodeAndTitleColumn
		= STUFF(
	(
		SELECT DISTINCT
			   ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
			   + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
		FROM STF.Trace
		WHERE DlTypeID IS NOT NULL
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
			   );

	IF @CodeAndTitleColumn IS NULL
		SET @CodeAndTitleColumn = N' ';

	SELECT @LeftJoin
		= STUFF(
	(
		SELECT DISTINCT
			   ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
			   + '.DlID = piv.' + QUOTENAME(TraceID)
		FROM STF.Trace
		WHERE DlTypeID IS NOT NULL
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
			   );

	IF @LeftJoin IS NULL
		SET @LeftJoin = N' ';

	DECLARE @listLeftJoin NVARCHAR(MAX);

	SELECT @listLeftJoin
		= STUFF(
	(
		SELECT DISTINCT
			   ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
			   + '.TraceItemID = piv.' + QUOTENAME(TraceID)
		FROM STF.Trace
		WHERE AccountLevelTypeID = 6
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
			   );

	IF @listLeftJoin IS NULL
		SET @listLeftJoin = N' ';

	SET @query
		= N'
			SELECT  rsji.ReturnedSaleJustificationItemID ,
					rsj.ReturnedSaleJustificationID ,
					rsj.Number ,
					CFG.GetCLRSaturnDate(rsj.[Date], @dateFormat ,0,@dateType) DateString,
					rsji.StuffID ,
					s.IsStuffSerializable,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
						 when ' + CAST(@CultureNo AS CHAR(1))
		  + N' = 2 then s.Title2
					end as StuffTitle ,
					s.Code StuffCode ,
					s.StuffDetailType,
					rsji.MainQuantity ,
					rsji.SubQuantity ,
					rsji.Price ,
					rsji.Discount ,
					rsjr.NonPrice,
					rsjr.NonDiscount,
					rsjr.Non ,
					rsjr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
		  + N'	
			FROM    SLE.ReturnedSaleJustificationItem rsji
					JOIN SLE.ReturnedSaleJustification rsj ON rsj.ReturnedSaleJustificationID = rsji.ReturnedSaleJustificationID
					JOIN SLE.ReturnedSaleJustification_Remain rsjr ON rsjr.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
					JOIN STF.vwStuff s ON s.StuffID = rsji.StuffID
					JOIN CFG.Party p ON p.PartyID = rsj.CustomerID
					LEFT JOIN (SELECT tr.ReturnedSaleJustificationItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
										WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
										ELSE tr.Value
								   END Value
								   FROM SLE.ReturnedSaleJustificationItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
		  + N' )
							) AS piv ON piv.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
							' + @LeftJoin + N' ' + @listLeftJoin
		  + N'
			WHERE   rsjr.Non > 0
					AND p.DlID = @dlId
					AND (@saleAreaId is null or rsj.SaleAreaID = @saleAreaId)
					AND (@saleTypeId IS NULL OR rsj.[SaleTypeId] = @saleTypeId)
					AND rsj.[Status] <> 2
					AND rsj.[Date] <= @date';

	IF @StuffID IS NOT NULL
	   OR @StuffID <> ''
		SET @query = @query + N' and rsji.stuffID = ' + CAST(@StuffID AS NVARCHAR(256));

	PRINT @query;

	EXEC sp_executesql @query,
					   N'	
			@dlId BIGINT,
			@date DATE ,
			@SaleTypeId INT ,
			@ids NVARCHAR(MAX),
			@dateFormat nvarchar(20),
			@dateType TINYINT,
			@saleAreaId INT
		',
					   @date = @date,
					   @dlId = @dlId,
					   @saleTypeId = @saleTypeId,
					   @ids = @ids,
					   @DateFormat = @DateFormat,
					   @DateType = @DateType,
					   @saleAreaId = @saleAreaId;

END;

