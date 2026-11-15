
CREATE  
 PROCEDURE CFG.spRptReserved_Branch
(
    @financialPeriodId          INT,
    @selectedStuff              NVARCHAR(MAX) = NULL,
    @selectedStuffGroup         NVARCHAR(MAX) = NULL,
    @selectedStuffSaleGroup     NVARCHAR(MAX) = NULL,
    @selectedStuffTrace         NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
	IF NOT EXISTS (
	       SELECT c.ConfigValue
	       FROM   [CFG].[Configuration] AS c
	       WHERE  c.ConfigKey = 'ConsumeReservedStoreIsControlable'
	              AND c.ConfigValue = 'true'
	   )
	   AND NOT EXISTS (
	           SELECT c.ConfigValue
	           FROM   [CFG].[Configuration] AS c
	           WHERE  c.ConfigKey = 'ReservedStoreIsControlable'
	                  AND c.ConfigValue = 'true'
	       )
	    RETURN;
	
	DECLARE @TableName1         NVARCHAR(MAX),
	        @inventoryTable     NVARCHAR(MAX),
	        @reservedTable      NVARCHAR(MAX),
	        @query              NVARCHAR(MAX),
	        @Date               DATE,
	        @Stuffs             NVARCHAR(MAX);
	
	SET @inventoryTable = CFG.getTempTableName(1);
	SET @TableName1 = CFG.getTempTableName(1);
	SET @reservedTable = CFG.getTempTableName(1);
	SELECT @Date = MAX(fp.EndDate)
	FROM   cfg.FinancialPeriod AS fp;
	
	SELECT VALUE StuffGroupID  into #SelectedStuffGroup	
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup)
	
	SELECT VALUE StuffID  into #SelectedStuff
	FROM   CFG.R_FnCommaStr2Table(@selectedStuff) 
	
		SELECT VALUE StuffSaleGroupID  into #selectedStuffSaleGroup
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffSaleGroup) 
	

	
	
SELECT @Stuffs =  STUFF(( SELECT  ',' + CAST( s.StuffID as NVARCHAR(250)) 
FROM   stf.[Stuff]                        AS s
       JOIN stf.StuffDetail               AS sd
            ON  s.StuffID = sd.StuffID
       left JOIN #SelectedStuffGroup      AS ssg
            ON  s.StuffGroupID = ssg.StuffGroupID
       left JOIN #selectedStuffSaleGroup  AS sssg
            ON  sssg.StuffSaleGroupID = sd.SalesGroupID
       left JOIN #SelectedStuff ss
            ON  s.StuffID = ss.StuffID
WHERE  (@selectedStuff is null OR ss.StuffID is NOT NULL)
       AND (@selectedStuffGroup is null or ssg.StuffGroupID is NOT NULL)
       and (@selectedStuffSaleGroup is null or sssg. StuffSaleGroupID is NOT NULL)
       FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   , 1 ,''  );
       
	
	EXEC stc.spGetInventoryInDate
	     @StuffId = @Stuffs,
	     @stockID = null,
	     @ToDate = @Date,
	     @FinalTable = @TableName1
	
	EXEC (
	         N'select s.BranchID,Sum(MainQuantity) MainQuantity
	          into ' + @inventoryTable + N' from ' + @TableName1 + 
	         N' src
join stf.Stock s on src.StockID = s.StockID  
        Group By s.BranchID'
	)

	
	SELECT BranchID,
	       SUM(vrs.Non)             Reserved
	INTO   #ReservedStuff
	FROM   cfg.vwReservedStuffs  AS vrs
	GROUP BY vrs.BranchID
	
	
	SET @query = 
	    N'
		SELECT b.BranchID ,
				b.Code ,
				b.Title ,
				b.Title2,
				it.MainQuantity MainInLine ,
				rs.Reserved MainReserved ,
				isnull(it.MainQuantity,0) - isnull(rs.Reserved,0) NonMainReserved 
		FROM   '+@inventoryTable + N' it
		full  join #ReservedStuff rs  on rs.BranchID = it.BranchID 
		JOIN CFG.Branch AS b ON b.BranchID = isnull(it.BranchID,rs.BranchID);

			'
EXEC (@query)
END;
