
--------------------------------------

CREATE   PROC PRM.spRptProductionReview_Stuff

(
    @SelectedCostCenter NVARCHAR(MAX) = NULL,
	@CostCalculationPeriodID int 
)
--WITH ENCRYPTION 
AS
DECLARE @User						INT,
        @tableName					NVARCHAR(255),
        @tableName1					NVARCHAR(255),
        @query						NVARCHAR(MAX),
        @Culture					VARCHAR(25),
        @CultureNo					TINYINT
     
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;

SET @tableName = CFG.getTempTableName(1);
SET @tableName1 = CFG.getTempTableName(1);
SET @User = CFG.GetuserID();

exec prm.spProductionReviewDataSource
	 @CostCalculationPeriodID = @CostCalculationPeriodID,
    @TableName = @tableName,
    @SelectedStuff = Null,
    @SelectedCostCenter =  @SelectedCostCenter,
    @GroupByField = 'StuffID'

SET @query = N'SELECT   A.ID StuffID,	 
sum(case when a.DataType = ''ProductionWorkingInventory'' then a.MainQuantity else 0 end) FirstMainQuantity,
sum(case when a.DataType = ''ProductionStatistic'' then a.MainQuantity else 0 end) ProductionStatisticMainQuantity,
sum(case when a.DataType = ''ProductionDelivery'' then a.MainQuantity else 0 end) ProductionDeliveryMainQuantity,
sum(case when a.DataType = ''StockReceipt'' then a.MainQuantity else 0 end) StockReceiptMainQuantity,
SUM( a.MainQuantity) EndMainQuantity
				into ' + @tableName1 + '			
				FROM ' + @tableName + N' A			
				 GROUP BY A.ID ';
				 	
EXECUTE sp_executesql @query


select * into #vwStuff from stf.VWStuff
--------------------------------
SET @query = N'
   select   s.Code AS CostCenterCode ,
			 case when @CultureNo = 1 then s.Title else s.Title2  end as StuffTitle,
			 MainMeasureUnit,	MainMeasureUnit2,
			 A.*                 
    FROM     ' + @tableName1 + N' A 
    JOIN #vwStuff s on a.StuffID = s.StuffID';
EXECUTE sp_executesql @query,
					 N'@CultureNo Tinyint',
					 @CultureNo = @CultureNo;
