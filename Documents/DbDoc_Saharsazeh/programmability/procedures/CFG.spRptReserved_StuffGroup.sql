


CREATE    PROCEDURE CFG.spRptReserved_StuffGroup
    (
        @financialPeriodID INT ,
        @selectedBranchs NVARCHAR(MAX) = NULL ,
        @selectedStuff NVARCHAR(MAX) = NULL ,
        @selectedStuffSaleGroup NVARCHAR(MAX) = NULL ,
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
        set @TableName1 =  CFG.getTempTableName(1);

	
	SELECT VALUE StuffID  into #SelectedStuff
	FROM   CFG.R_FnCommaStr2Table(@selectedStuff) 
	
		SELECT VALUE StuffSaleGroupID  into #selectedStuffSaleGroup
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffSaleGroup) 
	
	
	IF @selectedStuff is NOT NULL
	    SELECT @Stuffs = STUFF(
	               (
	                   SELECT ',' + CAST(s.StuffID as NVARCHAR(250))
	                   FROM   stf.[Stuff] AS s
	                          JOIN stf.StuffDetail AS sd
	                               ON  s.StuffID = sd.StuffID
	                          left JOIN #SelectedStuffGroup AS ssg
	                               ON  s.StuffGroupID = ssg.StuffGroupID
	                          left JOIN #SelectedStuff ss
	                               ON  s.StuffID = ss.StuffID
	                   WHERE  (@selectedStuff is null OR ss.StuffID is NOT NULL)
	                         AND (
	                                  @selectedStuffSaleGroup is null
	                                  OR sssg. StuffSaleGroupID is NOT NULL
	                              )
	                              FOR XML PATH(''), TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
       
	
	EXEC stc.spGetInventoryInDate
	     @StuffId = @Stuffs,
	     @stockID = null,
	     @ToDate = @Date,
	     @FinalTable = @TableName1

    	
	EXEC (
	         N'select s.StuffGroupID,Sum(MainQuantity) MainQuantity
	          into ' + @inventoryTable + N' from ' + @TableName1 + 
	         N' src
			join stf.Stuff s on src.StuffID = s.StuffID  
			Group By s.StuffGroupID'
	)

	
	SELECT StuffID,
	       SUM(vrs.Non)             Reserved
	INTO   #ReservedStuff1
	FROM   cfg.vwReservedStuffs  AS vrs
	GROUP BY vrs.StuffID
	
	
	SELECT s.StuffGroupID,
	       SUM(vrs.Reserved)             Reserved
	INTO   #ReservedStuff
	FROM   #ReservedStuff1  AS vrs
	join stf.[Stuff] AS s on vrs.StuffID = s.StuffID
	GROUP BY s.StuffGroupID
	

	
	
	SET @query = 
	    N'
		SELECT b.StuffGroupID ,
				b.Code ,
				b.Title ,
				b.Title2,
				it.MainQuantity MainInLine ,
				rs.Reserved MainReserved ,
				isnull(it.MainQuantity,0) - isnull(rs.Reserved,0) NonMainReserved 
		FROM   '+@inventoryTable + N' it
		full  join #ReservedStuff rs  on rs.StuffGroupID = it.StuffGroupID 
		left JOIN stf.StuffGroup AS b ON b.StuffGroupID = isnull(it.StuffGroupID,rs.StuffGroupID);' 
	
		
		EXEC (@query)
   END;
