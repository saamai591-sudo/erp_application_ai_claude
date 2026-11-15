
CREATE   PROC [STM].SpRptRecountingInventoryTag
    @ID NVARCHAR(MAX),
    @itemIds NVARCHAR(MAX)
-- WITH ENCRYPTION 
AS
BEGIN
    CREATE TABLE #Ids
    (
        RecountingInventoryTagItemID INT NOT NULL
    );

    INSERT INTO #Ids
    (
        RecountingInventoryTagItemID
    )
    SELECT [value]
    FROM CFG.R_FnCommaStr2Table(@itemIds);

    IF @itemIds IS NULL
       OR @itemIds = ''
    BEGIN

        INSERT INTO #Ids
        (
            RecountingInventoryTagItemID
        )
        SELECT RecountingInventoryTagItemID
        FROM STC.RecountingInventoryTagItem
        WHERE EXISTS
        (
            SELECT [value]
            FROM CFG.R_FnCommaStr2Table(@ID)
            WHERE value = RecountingInventoryTagID
        );

    END;

    DECLARE @Columns AS NVARCHAR(MAX),
            @Query AS NVARCHAR(MAX);

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SELECT *
    INTO #vwStuff
    FROM STF.VWStuff;

    SET @Query
        = N'SELECT 
			It.TagNumber Number,
			re.RecountingInventoryTagID,
			i.CountingTurns,
			a.Code StuffCode,
			b.StockID,
			a.Title StuffTitle,
			b.Code StockCode,
			b.Title StockTitle,
			cfg.GetSaturnDate(rip.Date,0) as [Date]
			,MainMeasureUnit UnitTitle,
			' + @Columns
          + N',
			b.Supervisor,
			it.TagNumber,
            a.Barcode,
            a.IranCode
from STC.RecountingInventoryTag re
JOIN STC.RecountingInventoryPeriod rip ON re.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
join STC.RecountingInventoryTagItem It on It.RecountingInventoryTagID=re.RecountingInventoryTagID 
JOIN STC.InventoryMethod i ON i.InventoryMethodID = rip.InventoryMethodID
left join 
  (
	select  RecountingInventoryTagItemID,
			TraceID,
			Case When t.DLID IS NOT NULL 
					THEN cast ((select title from acc.DL d where d.DLID=t.DlID) as nvarchar(max)) 
				 else Value end Value
    from STC.RecountingInventoryTagItemTrace t
  ) x
  pivot 
  (
	 max(Value)
	for TraceID in ( ' + @Columns
          + N')
  )  piv on piv.RecountingInventoryTagItemID = It.RecountingInventoryTagItemID
join #vwStuff a on a.StuffID=It.StuffID
join STF.Stock b on b.StockID=rip.StockID
join #Ids on #Ids.RecountingInventoryTagItemID = It.RecountingInventoryTagItemID
order by It.TagNumber ';

    EXECUTE sys.sp_executesql @Query;
END;
