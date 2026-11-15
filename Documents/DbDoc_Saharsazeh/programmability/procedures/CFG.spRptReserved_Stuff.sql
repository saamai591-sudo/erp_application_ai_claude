-----------------------------------------------------


CREATE     PROCEDURE CFG.spRptReserved_Stuff
    (
        @financialPeriodID INT ,
        @selectedBranchs NVARCHAR(MAX) = NULL ,
        @selectedStuffGroup NVARCHAR(MAX) = NULL ,
        @selectedStuffSaleGroup NVARCHAR(MAX) = NULL,
        @SelectedStuffTrace NVARCHAR(MAX) = NULL
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
        
        DECLARE @inventoryTable          NVARCHAR(20),
                @reservedTable           NVARCHAR(20),
                @stuffTraceTableName     NVARCHAR(MAX),
                @query                   NVARCHAR(MAX),
                @joinColumns             NVARCHAR(MAX),
                @Stuffs                  NVARCHAR(MAX),
                @Date                    DATE,
                @TableName1              NVARCHAR(MAX);
        
        SET @inventoryTable = CFG.getTempTableName(1);
        SET @reservedTable = CFG.getTempTableName(1);
        SET @TableName1 = CFG.getTempTableName(1);

		SELECT @Date = MAX(fp.EndDate)
	FROM   cfg.FinancialPeriod AS fp;
       
       	SELECT VALUE StuffGroupID  into #SelectedStuffGroup	
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffGroup)
		
		SELECT VALUE StuffSaleGroupID  into #selectedStuffSaleGroup
	FROM   CFG.R_FnCommaStr2Table(@selectedStuffSaleGroup) 
	
	SELECT @Stuffs = STUFF(
	           (
	               SELECT ',' + CAST(s.StuffID as NVARCHAR(250))
	               FROM   stf.[Stuff] AS s
	                      JOIN stf.StuffDetail AS sd
	                           ON  s.StuffID = sd.StuffID
	                      left JOIN #SelectedStuffGroup AS ssg
	                           ON  s.StuffGroupID = ssg.StuffGroupID
	                      left JOIN #selectedStuffSaleGroup AS sssg
	                           ON  sssg.StuffSaleGroupID = sd.SalesGroupID
	               WHERE  (
	                          @selectedStuffGroup is null
	                          OR ssg.StuffGroupID is NOT NULL
	                      )
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
	         'select src.StuffID,Sum(MainQuantity) MainQuantity
	          into ' + @inventoryTable + ' from ' + @TableName1 +
	         ' src 
			 Group By src.StuffID'
	)	
		SELECT StuffID,
	       SUM(vrs.Non)             Reserved
	INTO   #ReservedStuff
	FROM   cfg.vwReservedStuffs  AS vrs
	GROUP BY vrs.StuffID
	
	

	SELECT * into #vwStuff
	FROM stf.VWStuff AS v
	
	
		SET @query = 
	    N'
		SELECT b.StuffID ,
				b.Code ,
				b.Title ,
				b.Title2,
				it.MainQuantity MainInLine ,
				rs.Reserved MainReserved ,
				isnull(it.MainQuantity,0) - isnull(rs.Reserved,0) NonMainReserved 
		FROM   '+@inventoryTable + N' it
		full  join #ReservedStuff rs  on rs.StuffID = it.StuffID 
		JOIN #vwStuff AS b ON b.StuffID = isnull(it.StuffID,rs.StuffID);

			'
EXEC (@query)
      

     
     
    END;
