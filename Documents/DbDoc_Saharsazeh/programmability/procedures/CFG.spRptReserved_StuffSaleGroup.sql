
CREATE    PROCEDURE CFG.spRptReserved_StuffSaleGroup
    (
        @financialPeriodID INT ,
        @selectedBranchs NVARCHAR(MAX) = NULL ,
        @selectedStuff NVARCHAR(MAX) = NULL ,
        @selectedStuffGroup NVARCHAR(MAX) = NULL ,
        @selectedStuffTrace NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN
	
        IF NOT EXISTS (   SELECT c.ConfigValue
                          FROM   [CFG].[Configuration] AS c
                          WHERE  c.ConfigKey = 'ConsumeReservedStoreIsControlable'
                                 AND c.ConfigValue = 'true' )
           AND NOT EXISTS (   SELECT c.ConfigValue
                             FROM   [CFG].[Configuration] AS c
                             WHERE  c.ConfigKey = 'ReservedStoreIsControlable'
                                    AND c.ConfigValue = 'true' )
            RETURN;

        DECLARE @inventoryTable          NVARCHAR(20),
                @reservedTable           NVARCHAR(20),
                @stuffTraceTableName     NVARCHAR(MAX),
                @query                   NVARCHAR(MAX),
                @joinColumns             NVARCHAR(MAX),
                @TableName1              NVARCHAR(MAX),
                @Date                    DATE,
                @Stuffs                  NVARCHAR(MAX);

        SET @inventoryTable = CFG.getTempTableName(1);
        SET @reservedTable = CFG.getTempTableName(1);
        SET @stuffTraceTableName = CFG.getTempTableName(1);        
        SET @TableName1 =  CFG.getTempTableName(1);


	SELECT VALUE StuffID  into #SelectedStuff
	FROM   CFG.R_FnCommaStr2Table(@selectedStuff) 
	
		SELECT VALUE StuffSaleGroupID  into #selectedStuffSaleGroup
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup) 
	
		SELECT VALUE StuffGroupID  into #SelectedStuffGroup	
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup)
	
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
       FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   , 1 ,''  );
       
	
	EXEC stc.spGetInventoryInDate
	     @StuffId = @Stuffs,
	     @stockID = null,
	     @ToDate = @Date,
	     @FinalTable = @TableName1
	     
 
EXEC (
	         N'select s.SalesGroupID,Sum(MainQuantity) MainQuantity
	          into ' + @inventoryTable + N' from ' + @TableName1 + 
	         N' src
			join stf.StuffDetail s on src.StuffID = s.StuffID  
			Group By s.SalesGroupID'
	)
	     

	SELECT StuffID,
	       SUM(vrs.Non)             Reserved
	INTO   #ReservedStuff1
	FROM   cfg.vwReservedStuffs  AS vrs
	GROUP BY vrs.StuffID
	
	
	SELECT s.SalesGroupID,
	       SUM(vrs.Reserved)             Reserved
	INTO   #ReservedStuff
	FROM   #ReservedStuff1  AS vrs
	join stf.[StuffDetail] AS s on vrs.StuffID = s.StuffID
	GROUP BY s.SalesGroupID
		     

      SET @query = 
	    N'
		SELECT b.GroupID SalesGroupID ,
				b.Code ,
				b.Title ,
				b.Title2,
				it.MainQuantity MainInLine ,
				rs.Reserved MainReserved ,
				isnull(it.MainQuantity,0) - isnull(rs.Reserved,0) NonMainReserved 
		FROM   '+@inventoryTable + N' it
		full  join #ReservedStuff rs  on rs.SalesGroupID = it.SalesGroupID 
		left JOIN cfg.[Group] AS b ON b.GroupID = isnull(it.SalesGroupID,rs.SalesGroupID);' 
	
		
		EXEC (@query)
    END;

