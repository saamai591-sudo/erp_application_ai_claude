
------------------------------------- START #8354
Create      PROC [STC].SpFindRealInventory
(
    @StockID INT = NULL,
    @Date DATE,
    @FinancialPeriodID INT,
    @BranchId INT = NULL
)
--WITH ENCRYPTION
AS
DECLARE @FindRealInventoryTempdb     NVARCHAR(20),
        @InventoryTable              NVARCHAR(250),
        @InventorySummaryTable       NVARCHAR(250);

SET @FindRealInventoryTempdb = CFG.getTempTableName(1);
SET @InventoryTable = CFG.getTempTableName(1);
SET @InventorySummaryTable = CFG.getTempTableName(1);

EXEC stc.spGetInventoryInDate
     @StuffId = Null,
     @stockID = @StockID,
     @ToDate = @Date,
     @FinalTable = @InventoryTable

DECLARE @query NVARCHAR(MAX);   
 
 select *
 into #vwStockAccess
 from cfg.vwStockAccess
 
SET @query = N'select StuffID,Sum(MainQuantity) MainQuantity 
                into ' + @InventorySummaryTable + N'
                from ' + @InventoryTable + N' src 
                join #vwStockAccess s on s.stockid = src.stockid
                group by src.StuffID'

EXEC (@query)
       
DECLARE @SummaryReserevedInventory NVARCHAR(MAX) 
SET @SummaryReserevedInventory = cfg.getTempTableName(1);
    
SET @query = N'
    Create   TABLE ' + @SummaryReserevedInventory + N'(StuffID int   ,    MainReserved DECIMAL(36,10)) '

EXEC (@query)
                 
SET @query = N' Insert into ' + @SummaryReserevedInventory + 
    N' SELECT   StuffID ,
                                    SUM(Non) AS MainReserved 
                           FROM    cfg.vwReservedStuffs
                           GROUP BY StuffID     '

PRINT @query
                                  
EXEC (@query)           

print @InventorySummaryTable

SET @query = 
    N'
SELECT   CAST(TRes.StuffID AS BIGINT) AS ID ,
             TRes.MainQuantity AS RealInventory ,
             ISNULL(R.MainReserved, 0) ReservedInventory
    FROM   ' + @InventorySummaryTable + N' TRes
             LEFT JOIN ' + @SummaryReserevedInventory + N'  R ON R.StuffID = TRes.StuffID
    ORDER BY TRes.StuffID'

print @query
EXEC (@query)
