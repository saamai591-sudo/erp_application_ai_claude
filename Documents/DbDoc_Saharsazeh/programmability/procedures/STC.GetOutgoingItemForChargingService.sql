------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].[GetOutgoingItemForChargingService]
(
    @dlId BIGINT,
    @date DATE,
    @financialPeriodId INT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @userId INT,
            @culture NVARCHAR(10),
            @cultureNo INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(12),
            @DynamicColumns NVARCHAR(MAX),
            @SelectColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX);

    SET @userId = CFG.GetuserID();
    SET @culture = CFG.GetuserCulture();
	SELECT @cultureNo = ci.CultureNo FROM CFG.CultureInfo AS ci
	WHERE ci.Culture =  @culture

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

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
		
	DECLARE @listLeftJoin NVARCHAR(MAX)

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
	SELECT oi.OutgoingItemID,
		   CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) AS DateString,
		   o.Number,
		   oi.RowIndex,
		   oi.StuffID,
		   STF.GetStuffCode(oi.StuffID) AS StuffCode,
		   CASE
			   WHEN @cultureNo = 2 THEN
				   s.Title2
			   ELSE
				   s.Title
		   END StuffTitle,
		   cast((CASE WHEN sd.MeasureSubUnitID IS NOT NULL THEN 1 ELSE 0 END) AS BIT) AS HasSubQuantity,
		   ore.Non AS MainQuantity,
		   ore.NonSub AS SubQuantity,
		   ' + @SelectColumns + N',0' + @CodeAndTitleColumn + N'
	FROM STC.OutgoingItem AS oi
		JOIN STC.Outgoing AS o
			ON o.OutgoingID = oi.OutgoingID
		JOIN STF.VWStuff AS s
			ON s.StuffID = oi.StuffID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		JOIN STC.StockDocumentType AS sdt
			ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		JOIN SLE.Outgoing_Remains AS ore
			ON ore.OutgoingItemID = oi.OutgoingItemID
		JOIN STF.StuffDetail AS sd 
			ON sd.StuffID = s.StuffID
		LEFT JOIN
		(
			SELECT oit.OutgoingItemID,
				   t.TraceID,
				   case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
						when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
						when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,@DateFormat , 0, @DateType)
					 else Value end [Value]
			FROM STC.OutgoingItemTrace AS oit
			join stf.trace t on t.traceid = oit.traceid
		) x
		PIVOT
		(
			MAX(x.[Value])
			FOR x.TraceID IN (' + @DynamicColumns + N')
		) AS piv
			ON piv.OutgoingItemID = oi.OutgoingItemID
			' + @LeftJoin + ' ' + @listLeftJoin + N'
	WHERE sdt.DocumentType = 14
		  AND o.DeliverDlID = @dlId
		  AND o.[Date] <= @date';

		EXEC sp_executesql @query,
						   N'@dlId					BIGINT, 
						 @date					DATE,
						 @DateFormat			VARCHAR(12),
						 @DateType				INT,
						 @cultureNo				INT,
						 @financialPeriodId		INT',
						   @dlId = @dlId,
						   @date = @date,
						   @DateFormat = @DateFormat,
						   @DateType = @DateType,
						   @cultureNo = @cultureNo,
						   @financialPeriodId = @financialPeriodId;
	END;
