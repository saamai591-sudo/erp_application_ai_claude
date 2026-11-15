
CREATE   PROC [PRM].CreateNewConsumptionStatisticByBaseForm
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
    WHERE dnt.EngName = 'ConsumptionStatistic';

    IF @engName = 'ProductionDelivery'
    BEGIN
        SELECT 0 as Number
	          ,-1 AS ConsumptionStatisticId
              ,a.[Date] as Date
              ,BaseType
              ,@UserID as [Creator]
              ,getdate()  as [CreationDate]
              ,@UserID as [LastEditor]
              ,getdate()  as [LastEditionDate]
              ,a.[Version]
	          ,a.DeliverCostCenterId CostCenterId
	          ,b.Title CostCenterTitle
        from prm.ProductionDelivery a
        join cfg.CostCenter b
	        on a.DeliverCostCenterId = b.CostCenterId
        where ProductionDeliveryID = @entityId

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS INT) AS ConsumptionStatisticItemId
              ,CAST(ROW_NUMBER() OVER (ORDER BY rm.RowIndex) AS smallint) AS  [RowIndex]
              ,rm.[StuffID]
	          ,s.Code StuffCode
	          ,s.Title StuffTitle
              ,[MainQuantity]
              ,[SubQuantity]
              ,null as [Description]
              ,null as [Description2]
              ,@UserID as [Creator]
              ,GETDATE() as [CreationDate]
              ,@UserID as [LastEditor]
              ,GETDATE() as [LastEditionDate]
              ,0 as [Version]
	          ,rm.ProductionDeliveryItemID
	          into #T
          FROM prm.ProductionDeliveryItem rm
          join stf.stuff s
	        on s.StuffID = rm.StuffID
          where ProductionDeliveryID = @entityId

        select ConsumptionStatisticItemId
	          ,-1 AS ConsumptionStatisticId
	          ,[RowIndex]
	          ,[StuffID]
	          ,StuffCode
	          ,StuffTitle
              ,[MainQuantity]
              ,[SubQuantity]
              ,[Description]
              ,[Description2]
              ,[Creator]
              ,[CreationDate]
              ,[LastEditor]
              ,[LastEditionDate]
              ,[Version] 
	        from #T

        SELECT  CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS ConsumptionStatisticItemTraceID,
			    i.ConsumptionStatisticItemID,
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
        FROM prm.ProductionDeliveryItemTrace AS jit
            JOIN #T AS i
                ON i.ProductionDeliveryItemID = jit.ProductionDeliveryItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = jit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = jit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = jit.TraceItemID
    END;
