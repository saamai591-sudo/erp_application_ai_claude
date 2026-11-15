
--------------------------------------

CREATE   PROC PRM.spProductionReviewDataSource
(   @CostCalculationPeriodID INT,
    @TableName NVARCHAR(500),
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedCostCenter NVARCHAR(MAX) = NULL,
    @GroupByField NVARCHAR(250)
)
--WITH ENCRYPTION 
AS

DECLARE @query                           NVARCHAR(MAX),
        @stuffInfo                       NVARCHAR(15),
        @CostCalculationStartingDate     DATE,
        @PreviousCostCalculationPeriodID int


SET NOCOUNT ON

SELECT @CostCalculationStartingDate = ccp.StartDate
FROM   prm.CostCalculationPeriod AS ccp
WHERE  ccp.CostCalculationPeriodID = @CostCalculationPeriodID

SELECT @PreviousCostCalculationPeriodID = ccp.CostCalculationPeriodID
FROM   prm.CostCalculationPeriod AS ccp
WHERE  ccp.EndDate = DATEADD(DAY, -1, @CostCalculationStartingDate)

SELECT VALUE StuffID
INTO   #SelectedStuff
FROM   CFG.R_FnCommaStr2Table(@SelectedStuff) 

SELECT VALUE CostCenterID
INTO   #SelectedCostCenterID
FROM   CFG.R_FnCommaStr2Table(@SelectedCostCenter)

SELECT cc.CostCenterID ccID,cc.DlID CostCenterDlID INTO #CostCenter
FROM cfg.CostCenter AS cc
LEFT JOIN #SelectedCostCenterID scc ON cc.CostCenterID = scc.CostCenterID
WHERE @SelectedCostCenter IS NULL OR scc.CostCenterID IS NOT NULL



SET @stuffInfo = CFG.getTempTableName(1);

SET @query = N'
			select a.StuffID as stfID
			into ' + @stuffInfo + 
    N'
			from stf.stuff a 
			join stf.StuffDetail b on a.StuffID = b.StuffID
			left join #SelectedStuff ss on ss.StuffID = a.StuffID
			where (@SelectedStuff IS NULL OR ss.StuffID is not null
			)'

EXECUTE sp_executesql @query,
     N'@SelectedStuff				NVARCHAR(MAX)',
     @SelectedStuff = @SelectedStuff



       EXEC (N'Create table  ' + @tableName + N'
		(
		ID int,	
		MainQuantity decimal(36,10),
		DataType nvarchar(50))'
		)

SET @query = N'insert into ' + @TableName + 
    N' 
SELECT     ' + @GroupByField + 
    N'		,sum(wii.MainQuantity) AS MainQuantity,''ProductionWorkingInventory''
    FROM prm.WorkingInventory AS wi
join prm.WorkingInventoryItem AS wii on wii.WorkingInventoryID = wi.WorkingInventoryID
 join #CostCenter scci on wi.CostCenterID = scci.ccID
 join '+@stuffInfo+N' si on wii.StuffID = si.stfID
where wi.Type = 2 and wi.CostCalculationPeriodID = @PreviousCostCalculationPeriodID
group by '+@GroupByField


        EXECUTE sp_executesql @query,
         N'@PreviousCostCalculationPeriodID int',
         @PreviousCostCalculationPeriodID = @PreviousCostCalculationPeriodID
	   
	   print 53
SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N'		,sum(ii.MainQuantity) AS MainQuantity,''ProductionStatistic'' 
					
			FROM      PRM.ProductionStatistic i
			INNER JOIN PRM.ProductionStatisticItem ii ON i.ProductionStatisticID = ii.ProductionStatisticID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			INNER JOIN #CostCenter cc on i.CostCenterID = cc.ccID
			INNER JOIN ' + @stuffInfo + N' si on si.stfID = ii.StuffID
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID
			group by ' + @GroupByField 


    EXECUTE sp_executesql @query,
         N'@CostCalculationPeriodID int',
         @CostCalculationPeriodID = @CostCalculationPeriodID



		 SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N'		,sum(-ii.MainQuantity) AS MainQuantity,''ProductionDelivery'' 
					
			FROM      PRM.ProductionDelivery i
			INNER JOIN PRM.ProductionDeliveryItem ii ON i.ProductionDeliveryID = ii.ProductionDeliveryID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			INNER JOIN #CostCenter cc on i.CostCenterID = cc.ccID
			INNER JOIN ' + @stuffInfo + N' si on si.stfID = ii.StuffID
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID
			group by ' + @GroupByField 


    EXECUTE sp_executesql @query,
         N'@CostCalculationPeriodID int',
         @CostCalculationPeriodID = @CostCalculationPeriodID

SET @query = N'insert into ' + @TableName + N' 
				SELECT     ' + @GroupByField + 
    N'		,sum(-ii.MainQuantity) AS MainQuantity,''StockReceipt'' 
					
			FROM      STC.StockReceipt i
			INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			Inner Join acc.dl dl on i.DeliverDlID = dl.DlID
			INNER JOIN #CostCenter cc on dl.DlID = cc.CostCenterDlID
			Inner Join Cfg.CostCenter cos on cc.ccID = cos.CostCenterID
			INNER JOIN ' + @stuffInfo + N' si on si.StfID = ii.StuffID
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID
			group by ' + @GroupByField 

		
    EXECUTE sp_executesql @query,
         N'@CostCalculationPeriodID int',
         @CostCalculationPeriodID = @CostCalculationPeriodID;
