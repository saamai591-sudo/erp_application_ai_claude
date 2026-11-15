					
-----------------------------------------------------------		
CREATE   PROCEDURE [SLE].GetStuffsWithInventoryAndFee
(
    @branchId INT,
    @financialPeriodId INT,
    @stuffId INT = NULL,
    @groupId INT = NULL,
    @searchTerm NVARCHAR(500) = NULL,
    @IsRecently BIT = 0,
    @isMostly BIT = 0,
    @userId INT
)
AS
set nocount on;
BEGIN
    DECLARE @Culture VARCHAR(25),
            @CultureNo TINYINT,
            @ColumnsInCreateTable NVARCHAR(MAX),
            @TableName1 NVARCHAR(20) = CFG.getTempTableName(1),
            @Query NVARCHAR(MAX),
			@traces nvarchar(max),
			@Date DATE,
			@TableName NVARCHAR(MAX),@Stuffs NVARCHAR(MAX);
			
			set @Date = CAST(GETDATE() as DATE)

    SET @Culture = CFG.GetuserCulture();

	CREATE TABLE #Stuffs
	(StuffID INT)
	if @stuffId is NULL
	BEGIN
		
set @Query = N'
insert into #Stuffs
	SELECT StuffID  FROM stf.VWStuff AS v
	WHERE ('''+@searchTerm +N''' is null or  v.Title like N''%'+@searchTerm +'%'')
	'+CASE WHEN @groupId  is NOT NULL then N'and ('+CAST(@groupId as NVARCHAR(250)) + N' is null or v.StuffGroupID = '+CAST(@groupId as NVARCHAR(250)) + N')'
	else '' END +N' group by v.StuffID'
	EXEC (@Query)
	
	--print @query

  SELECT @Stuffs = STUFF(
  (
      SELECT DISTINCT
             ',' + CAST(StuffID as NVARCHAR(250))
      FROM #Stuffs
      FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'),
  1   ,
  1   ,
  ''     );
  
	END
	else 
		BEGIN
			INSERT INTO #Stuffs
			(
				StuffID
			)
			VALUES
			(
				@stuffId
			)
		END


    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
    
    set @TableName = cfg.getTempTableName(1)
    
  		declare @LastDate Date
		select    @LastDate =   Max(Date) from 
		stc.VwCardex
		if @LastDate is null
		begin 
		set @LastDate = @Date
		end
    
    EXEC stc.spGetInventoryInDate
    	@StuffId = @Stuffs,
    	@stockID = null,
    	@ToDate = @LastDate,
    	@FinalTable = @TableName
    	
    	    CREATE table #inventory 
    (
        StuffID INT NOT NULL,
        MainQuantity DECIMAL(18, 4) NOT NULL,
        SubQuantity DECIMAL(18, 4) NULL
    );



    SET @Query = N'insert into  #inventory 
    select StuffID,sum(MainQuantity) MainQuantity,0
     from '+@TableName + ' GROUP BY StuffID '

    EXEC (@Query);
    
    
    CREATE TABLE #ResTable
    (StuffID INT,
    Reserved DECIMAL(36,10))
   

    set @Query = N'
    insert into #ResTable 
SELECT vrs.StuffID,sum(Non) 
FROM cfg.vwReservedStuffs AS vrs  WHERE vrs.BranchID = '+CAST(@branchId as NVARCHAR(250)) 
+CASE WHEN @Stuffs is NOT NULL
then N'and  vrs.stuffid in ('+@Stuffs+N')' else '' END 
+N' group by vrs.stuffID'

--print @query
EXEC (@Query)

 SELECT s.StuffID,
           s.Code,
             CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
                   ELSE
                       ''
               END AS Title,
           ISNULL(t.MainQuantity,0) - ISNULL(rt.Reserved,0) MainQuantity,
           Null SubQuantity
    INTO #SRC
 FROM stf.[Stuff] AS s
 join #Stuffs AS s2 on s.StuffID = s2.StuffID
 left join #Inventory t on s.StuffID = t.StuffID
 left join #ResTable AS rt on s.StuffID = rt.StuffID
    WHERE 
          (
              @IsRecently = 0
              OR EXISTS
    (
        SELECT TOP (30)
               StuffID
        FROM SLE.QuotationItem
        WHERE Creator = @userId
              AND StuffID = s.StuffID
        ORDER BY QuotationItemID DESC
    )
          )
          AND
          (
              @isMostly = 0
              OR EXISTS
    (
        SELECT TOP (30)
               StuffID
        FROM
        (
            SELECT qi.StuffID,
                   COUNT(*) AS cnt
            FROM SLE.QuotationItem AS qi
            WHERE Creator = @userId
                  AND qi.StuffID = s.StuffID
            GROUP BY qi.StuffID
        ) TT
        ORDER BY cnt DESC
    )
          );

    SELECT s.StuffID,
           s.Code,
           s.Title,
           s.MainQuantity,
           s.SubQuantity,
		  s2.ExemptOfSellVat,
		  s2.DutyRate,
		  s2.TaxRate
    FROM #SRC AS s
	JOIN STF.Stuff AS s2 ON s2.StuffID = s.StuffID;

    SELECT CAST(ROW_NUMBER() OVER (ORDER BY pli2.StuffID) AS INT) Id,
           src.StuffID,
           pli2.Fee
    FROM
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY pli.StuffID ORDER BY pl.EffectiveDate DESC) RN,
               pl.PriceListID,
               pli.StuffID,
               pl.EffectiveDate
        FROM SLE.PriceListItem AS pli
            JOIN SLE.PriceList AS pl
                ON pl.PriceListID = pli.PriceListID
    ) src
        JOIN SLE.PriceListItem AS pli2
            ON pli2.PriceListID = src.PriceListID
               AND pli2.StuffID = src.StuffID
    WHERE src.RN = 1
          AND EXISTS
    (
     SELECT StuffID FROM #stuffs WHERE StuffID = src.StuffID
    );

END;
