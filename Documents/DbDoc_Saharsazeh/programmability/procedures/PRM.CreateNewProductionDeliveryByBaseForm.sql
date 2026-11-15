
CREATE   PROC [PRM].CreateNewProductionDeliveryByBaseForm
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
WHERE dnt.EngName = 'ProductionDelivery';

IF @engName = 'ProductionStatistic'
BEGIN
    SELECT 0 as Number,
           -1 AS ProductionDeliveryId
          ,a.[Date] as Date
          ,cast(3 as tinyint) BaseType
          ,@UserID as [Creator]
          ,getdate()  as [CreationDate]
          ,@UserID as [LastEditor]
          ,getdate()  as [LastEditionDate]
          ,a.[Version]
	      ,a.CostCenterId
	      ,b.Title CostCenterTitle
    from prm.ProductionStatistic a
    join cfg.CostCenter b
	    on a.CostCenterId = b.CostCenterID
      where ProductionStatisticID = @entityId

    SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY rm.ProductionStatisticItemID) AS INT) AS ProductionDeliveryItemId
          ,CAST(ROW_NUMBER() OVER (ORDER BY rm.ProductionStatisticItemID) AS smallint) AS  [RowIndex]
          ,rm.[StuffID]
	      ,s.Code StuffCode
	      ,s.Title StuffTitle
          ,vw.MainRemain [MainQuantity]
          ,vw.SubRemain [SubQuantity]
          ,null as [Description]
          ,null as [Description2]
          ,@UserID as [Creator]
          ,GETDATE() as [CreationDate]
          ,@UserID as [LastEditor]
          ,GETDATE() as [LastEditionDate]
          ,0 as [Version]
	      ,rm.ProductionStatisticItemID
	      ,rm.ProductionStatisticID
	      ,a.Number ProductionStatisticNumber
	      into #T
    FROM prm.ProductionStatisticItem rm
        join stf.stuff s
	        on s.StuffID = rm.StuffID
        join prm.ProductionStatistic a 
            on a.ProductionStatisticID = rm.ProductionStatisticID
        join prm.VWProductionStatisticItemRemain vw
	        on vw.ProductionStatisticItemID = rm.ProductionStatisticItemID
    where a.ProductionStatisticID = @entityId
        and vw.MainRemain > 0

    select ProductionDeliveryItemId,
            -1 AS ProductionDeliveryId,
		    [RowIndex],
		    [StuffID],
		    StuffCode,
		    StuffTitle,
		    [MainQuantity],
		    [SubQuantity],
		    [Description],
		    [Description2],
		    [Creator],
		    [CreationDate],
		    [LastEditor],
		    [LastEditionDate],
		    [Version] ,
		    ProductionStatisticItemID,
		    ProductionStatisticNumber
    from #T b

    SELECT  CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.ProductionStatisticItemID) AS INT) AS ProductionDeliveryItemTraceId,
		   i.ProductionDeliveryItemId,
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
    FROM prm.ProductionStatisticItemTrace AS jit
        JOIN #T AS i
            ON i.ProductionStatisticItemID = jit.ProductionStatisticItemID
        JOIN #TraceIds AS ti
            ON ti.TraceID = jit.TraceID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = jit.DlID
        LEFT JOIN STF.TraceItem AS ti2
            ON ti2.TraceItemID = jit.TraceItemID
END;
