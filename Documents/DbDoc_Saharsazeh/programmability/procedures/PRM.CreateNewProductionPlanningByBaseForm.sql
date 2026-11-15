CREATE    PROC [PRM].[CreateNewProductionPlanningByBaseForm]
(
    @engName NVARCHAR(100),
    @entityId INT
)
--WITH ENCRYPTION
AS
DECLARE @Culture NVARCHAR(100),
        @CultureNo TINYINT,
		@UserID int ;

set @UserID = cfg.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT DISTINCT
       tdnt.TraceID
INTO #TraceIds
FROM STF.StuffTraceDocumentNum AS stdn
    JOIN STF.TraceDocumentNumType AS tdnt
        ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
    JOIN CFG.DocumentNumType AS dnt
        ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
WHERE dnt.EngName = 'ProductionPlanning';

IF @engName = 'ProductionAnalysis'
BEGIN
    SELECT [FinancialPeriodID]
          ,-1 as ProductionPlanningID
          ,0 as [Number]
          ,Date as [Date]
          ,getdate()  as [StartDate]
          ,getdate()  as [EndDate]
          ,null as [ProductionProcessID]
          ,@UserID as [Creator]
          ,getdate()  as [CreationDate]
          ,@UserID as [LastEditor]
          ,getdate()  as [LastEditionDate]
          ,[Version]
	      ,cast(1 as TinyInt) State
    from prm.ProductionAnalysis
      where ProductionAnalysisID = @entityId

    SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS INT) AS [ProductionPlanningItemID]
          ,-1 as ProductionPlanningID
          ,CAST(ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS smallint) AS  [RowIndex]
          ,cast(3 as tinyint) as [BaseType]
          ,null as [ProductionOrderItemID]
	      ,rm.PlanningItemID
	      ,h.number BaseDocumentNumber
          ,rm.[StuffID]
	      ,s.Code StuffCode
	      ,s.Title StuffTitle
          ,rm.MainQuantity - isnull(ppi.MainQuantity , 0) [MainQuantity]
          ,null as [SubQuantity]
          ,null as [Description]
          ,null as [Description2]
          ,@UserID as [Creator]
          ,GETDATE() as [CreationDate]
          ,@UserID as [LastEditor]
          ,GETDATE() as [LastEditionDate]
          ,0 as [Version]
	      ,rm.CostCenterId
	      ,w.Title  CostCenterTitle
	      into #T
      FROM prm.PlanningItem rm
        left join
        (
            select PlanningItemID,Sum(MainQuantity) MainQuantity
            from prm.ProductionPlanningItem
            group by PlanningItemID
        )ppi on ppi.PlanningItemID = rm.PlanningItemID
        join prm.productionanalysis h 
            on h.ProductionAnalysisID = rm.ProductionAnalysisID
        join stf.stuff s
	        on s.StuffID = rm.StuffID
        join cfg.CostCenter w
	        on w.CostCenterID = rm.CostCenterID
      where h.ProductionAnalysisID = @entityId

    select * from #T where MainQuantity > 0
   
    SELECT   CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.[ProductionPlanningItemID]) AS INT) AS [ProductionPlanningItemTraceID],
			i.[ProductionPlanningItemID],
           jit.TraceID,
           jit.DlID,
           d.Code DlCode,
           CASE
               WHEN jit.TraceItemID IS NOT NULL THEN
                   CASE
                       WHEN @CultureNo = 2 THEN
                           ti2.Item2
                       ELSE
                           ti2.Item
                   END
               ELSE
                   jit.Value
           END Value,
           jit.Version,
           jit.Creator,
           jit.CreationDate,
           jit.LastEditor,
           jit.LastEditionDate,
           jit.TraceItemID
    FROM prm.PlanningItemTrace AS jit
        JOIN #T AS i
            ON i.PlanningItemID = jit.PlanningItemID
        JOIN #TraceIds AS ti
            ON ti.TraceID = jit.TraceID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = jit.DlID
        LEFT JOIN STF.TraceItem AS ti2
            ON ti2.TraceItemID = jit.TraceItemID
    where MainQuantity > 0
END;
