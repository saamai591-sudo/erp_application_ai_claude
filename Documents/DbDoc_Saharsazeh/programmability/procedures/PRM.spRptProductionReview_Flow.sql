
-------------------End NoTask1

------------------------------------- START #7386
CREATE   PROC [PRM].spRptProductionReview_Flow
(
    @SelectedCostCenter				NVARCHAR(MAX) = NULL,
    @SelectedStuff					NVARCHAR(MAX) = NULL,
	@CostCalculationPeriodID		int
)
--WITH ENCRYPTION 
AS
declare @CostCalculationStartingDate     DATE,
        @PreviousCostCalculationPeriodID int,
		@UserID INT,
		@DateType VARCHAR(10),
		@DateFormat VARCHAR(10);

set @DateFormat = cfg.GetCurrentUserDateFormat()
set @DateType = cfg.GetCurrentUserDateType()


SELECT @CostCalculationStartingDate = ccp.StartDate
FROM   prm.CostCalculationPeriod AS ccp
WHERE  ccp.CostCalculationPeriodID = @CostCalculationPeriodID

SELECT @PreviousCostCalculationPeriodID = ccp.CostCalculationPeriodID
FROM   prm.CostCalculationPeriod AS ccp
WHERE  ccp.EndDate = DATEADD(DAY, -1, @CostCalculationStartingDate)


select * into #vwEnums from cfg.VwEnums
where enum in ('SystemEntities')


		SELECT VALUE CostCenterID 
		INTO #SelectedCostCenter
		FROM      CFG.R_FnCommaStr2Table(@SelectedCostCenter)  
		group by VALUE
		
		SELECT cc.*,dl.Code Dlcode
		INTO #CostCenter
		 FROM cfg.CostCenter AS cc
		 join acc.DL dl on cc.DlID = dl.DLID
		LEFT JOIN #SelectedCostCenter AS scc ON cc.CostCenterID = scc.CostCenterID
		WHERE (@SelectedCostCenter IS NULL OR scc.CostCenterID IS NOT NULL)
				
		
		SELECT VALUE StuffID
		INTO   #SelectedStuff
		FROM   CFG.R_FnCommaStr2Table(@SelectedStuff)          
		group by VALUE

		select v.StuffID,v.code,v.Title,v.Title2,v.MainMeasureUnitID into #vwStuff
		from stf.VWStuff v
		left join #SelectedStuff ss on v.StuffID = ss.StuffID
		where (@SelectedStuff is null or ss.StuffID is not null)

SELECT    wi.Number,scci.Dlcode,scci.Title CostCenterTitle,scci.Title2 CostCenterTitle2,'WorkingInventory' Document,
@CostCalculationStartingDate Date, 
CFG.GetCLRSaturnDate(@CostCalculationStartingDate, @DateFormat, 0, @DateType) Date_Date,
 mu.Title MainUnit,
 mu.Title2 as MainUnit2,
wi.WorkingInventoryID DocumentID,si.code,
si.Title StuffTitle,si.Title2 StuffTitle2,wii.MainQuantity,
ve.Value EntityTitle
    FROM prm.WorkingInventory AS wi
join prm.WorkingInventoryItem AS wii on wii.WorkingInventoryID = wi.WorkingInventoryID
 join #CostCenter scci on wi.CostCenterID = scci.CostCenterID
 join #vwStuff si on wii.StuffID = si.StuffID
 JOIN STF.MeasureUnit AS mu
    ON mu.MeasureUnitID = si.MainMeasureUnitID
join #vwEnums ve on ve.Item = 'WorkingInventory'
where wi.Type = 2 and wi.CostCalculationPeriodID = @PreviousCostCalculationPeriodID

union all

SELECT      i.Number,cc.Dlcode,cc.Title CostCenterTitle,cc.Title2 CostCenterTitle2,'ProductionStatistic' Document,i.Date,
			CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) Date_Date,
			 mu.Title MainUnit,
			 mu.Title2 as MainUnit2,
			i.ProductionStatisticID DocumentID,si.code,si.Title StuffTitle,si.Title2 StuffTitle2,ii.MainQuantity,
ve.Value EntityTitle
			FROM      PRM.ProductionStatistic i
			INNER JOIN PRM.ProductionStatisticItem ii ON i.ProductionStatisticID = ii.ProductionStatisticID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			INNER JOIN #CostCenter cc on i.CostCenterID = cc.CostCenterID
			INNER JOIN #vwStuff si on si.StuffID = ii.StuffID
			JOIN STF.MeasureUnit AS mu ON mu.MeasureUnitID = si.MainMeasureUnitID
			join #vwEnums ve on ve.Item = 'ProductionStatistic'
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID
			

union all


		SELECT      i.Number,cc.Dlcode,cc.Title CostCenterTitle,cc.Title2 CostCenterTitle2,'ProductionDelivery' Document,i.Date,
					CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) Date_Date,
					 mu.Title MainUnit,
					 mu.Title2 as MainUnit2,
					i.ProductionDeliveryID DocumentID,si.code,si.Title StuffTitle,si.Title2 StuffTitle2,-ii.MainQuantity,
ve.Value EntityTitle

					
			FROM      PRM.ProductionDelivery i
			INNER JOIN PRM.ProductionDeliveryItem ii ON i.ProductionDeliveryID = ii.ProductionDeliveryID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			INNER JOIN #CostCenter cc on i.CostCenterID = cc.CostCenterID
			INNER JOIN #vwStuff si on si.StuffID = ii.StuffID
			JOIN STF.MeasureUnit AS mu ON mu.MeasureUnitID = si.MainMeasureUnitID
			join #vwEnums ve on ve.Item = 'ProductionDelivery'
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID

union all

SELECT      i.Number,cc.Dlcode,cc.Title CostCenterTitle,cc.Title2 CostCenterTitle2,'StockReceipt' Document,i.Date,
			CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) Date_Date,
			 mu.Title MainUnit,
			 mu.Title2 as MainUnit2,
			i.StockReceiptID DocumentID,si.code,si.Title StuffTitle,si.Title2 StuffTitle2,-ii.MainQuantity,
ve.Value EntityTitle
			FROM      STC.StockReceipt i
			INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
			INNER JOIN PRM.CostCalculationPeriod ccp on i.date between ccp.StartDate and ccp.EndDate
			Inner Join acc.dl dl on i.DeliverDlID = dl.DlID
			INNER JOIN #CostCenter cc on dl.DlID = cc.DlID
			INNER JOIN #vwStuff si on si.StuffID = ii.StuffID
			JOIN STF.MeasureUnit AS mu ON mu.MeasureUnitID = si.MainMeasureUnitID
			join #vwEnums ve on ve.Item = 'StockReceipt'
			WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID;
