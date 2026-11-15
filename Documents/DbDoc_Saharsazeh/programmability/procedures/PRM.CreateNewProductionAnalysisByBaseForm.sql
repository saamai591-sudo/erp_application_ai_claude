CREATE  PROC [PRM].[CreateNewProductionAnalysisByBaseForm]
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
WHERE dnt.EngName = 'ProductionFormula';

IF @engName = 'ProductionOrder'
BEGIN

    SELECT 0 as Number,
            -1 as ProductionAnalysisID,
            a.Date
          ,@UserID as [Creator]
          ,getdate()  as [CreationDate]
          ,@UserID as [LastEditor]
          ,getdate()  as [LastEditionDate]
          ,a.[Version]
    from prm.ProductionOrder a
     where ProductionOrderID = @entityId

    SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS INT) AS ProductionAnalysisItemID
          ,CAST(ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS smallint) AS  [RowIndex]
	      ,cast(2  as tinyint) BaseType
	      ,ProductionOrderItemID BaseID
          ,rm.[StuffID]
	      ,stf.GetStuffCode(rm.StuffID) StuffCode
	      ,s.Title StuffTitle
          ,rm.[MainQuantity] - isnull(pr.MainQuantity,0) [MainQuantity]
          ,@UserID as [Creator]
          ,GETDATE() as [CreationDate]
          ,@UserID as [LastEditor]
          ,GETDATE() as [LastEditionDate]
          ,0 as [Version]
	      ,a.Number BaseDocumentNumber
	      into #T
      FROM prm.ProductionOrderItem rm
      join stf.stuff s
	    on s.StuffID = rm.StuffID
      join prm.ProductionOrder a
	    on a.ProductionOrderID = rm.ProductionOrderID
	    left join
	    (
	    select BaseID,sum(MainQuantity) MainQuantity
	    from prm.ProductionAnalysisItem
	    where BaseType = 2
	    group by BaseID
	    ) pr on pr.BaseID = rm.ProductionOrderItemID
       where rm.ProductionOrderID = @entityId

   select -1 as ProductionAnalysisID, * from #t 
   where [MainQuantity] > 0

    SELECT  CAST(-1 * ROW_NUMBER() OVER (ORDER BY ProductionAnalysisItemID) AS INT) AS ProductionAnalysisItemTraceID,
        -1 as ProductionAnalysisID,
			i.ProductionAnalysisItemID,
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
    FROM prm.ProductionOrderItemTrace AS jit
        JOIN #T AS i
            ON i.BaseID = jit.ProductionOrderItemID
        JOIN #TraceIds AS ti
            ON ti.TraceID = jit.TraceID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = jit.DlID
        LEFT JOIN STF.TraceItem AS ti2
            ON ti2.TraceItemID = jit.TraceItemID
END;
