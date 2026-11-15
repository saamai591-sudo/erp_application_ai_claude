
CREATE      PROC [REQ].GetPurchaseRequestByBaseForm
(
    @engName NVARCHAR(100),
    @entityId INT
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Culture NVARCHAR(100),
            @CultureNo TINYINT;

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
    WHERE dnt.EngName = 'PurchaseRequest';


	select * into #vwStuff from stf.vwStuff

    IF @engName = 'Justification'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY ji.RowIndex) AS SMALLINT) RowIndex,
               ji.JustificationItemID,
               ji.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               j.Number RequestBaseNumber,
               jnr.Non AS MainQuantity,
               CASE
                   WHEN jnr.SubQuantity IS NULL THEN
                       NULL
                   ELSE
                       jnr.NonSub
               END AS SubQuantity
        INTO #items
        FROM SLE.JustificationItem AS ji
            JOIN SLE.Justification AS j
                ON j.JustificationID = ji.JustificationID
            JOIN SLE.Justification_Non_Request AS jnr
                ON jnr.JustificationItemID = ji.JustificationItemID
            JOIN #vwStuff AS s
                ON s.StuffID = ji.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE j.JustificationID = @entityId
              AND jnr.Non > 0
              AND
              (
                  jnr.SubQuantity IS NULL
                  OR jnr.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT CAST(6 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               j.BranchID,
               j.Date PurchaseRequestDate,
               j.FinancialPeriodID
        FROM SLE.Justification AS j
        WHERE j.JustificationID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.JustificationItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #items AS i;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
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
        FROM SLE.JustificationItemTrace AS jit
            JOIN #items AS i
                ON i.JustificationItemID = jit.JustificationItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = jit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = jit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = jit.TraceItemID;
    END;
    ELSE IF @engName = 'Quotation'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
               qi.QuotationItemID,
               qi.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               q.Number RequestBaseNumber,
               qnr.Non AS MainQuantity,
               CASE
                   WHEN qnr.SubQuantity IS NULL THEN
                       NULL
                   ELSE
                       qnr.NonSub
               END AS SubQuantity
        INTO #QuotationItems
        FROM SLE.QuotationItem AS qi
            JOIN SLE.Quotation AS q
                ON q.QuotationID = qi.QuotationID
            JOIN SLE.Quotation_Non_Request AS qnr
                ON qnr.QuotationItemID = qi.QuotationItemID
            JOIN #vwStuff AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE q.QuotationID = @entityId
              AND qnr.Non > 0
              AND
              (
                  qnr.SubQuantity IS NULL
                  OR qnr.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT CAST(7 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               q.BranchID,
               q.FinancialPeriodID,
               q.[Date] PurchaseRequestDate
        FROM SLE.Quotation AS q
        WHERE q.QuotationID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.QuotationItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #QuotationItems AS i;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
               qit.TraceID,
               qit.DlID,
               d.Code DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.Version,
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.QuotationItemTrace AS qit
            JOIN #QuotationItems AS i
                ON i.QuotationItemID = qit.QuotationItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'SaleContract'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY sci.RowIndex) AS SMALLINT) RowIndex,
               sci.SaleContractItemID,
               sci.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               sc.Number RequestBaseNumber,
               snr.Non AS MainQuantity,
               CASE
                   WHEN snr.SubQuantity IS NULL THEN
                       NULL
                   ELSE
                       snr.NonSub
               END AS SubQuantity
        INTO #SaleContractItems
        FROM SLE.SaleContractItem AS sci
            JOIN SLE.SaleContract AS sc
                ON sc.SaleContractID = sci.SaleContractID
            JOIN SLE.SaleContract_Non_Request AS snr
                ON snr.SaleContractItemID = sci.SaleContractItemID
            JOIN #vwStuff AS s
                ON s.StuffID = sci.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE sc.SaleContractID = @entityId
              AND snr.Non > 0
              AND
              (
                  snr.SubQuantity IS NULL
                  OR snr.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT CAST(8 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               BranchID,
               sc.FinancialPeriodID,
               [Date] PurchaseRequestDate
        FROM SLE.SaleContract AS sc
        WHERE sc.SaleContractID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.SaleContractItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #SaleContractItems AS i;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
               scit.TraceID,
               scit.DlID,
               d.Code DlCode,
               CASE
                   WHEN scit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       scit.Value
               END Value,
               scit.Version,
               scit.Creator,
               scit.CreationDate,
               scit.LastEditor,
               scit.LastEditionDate,
               scit.TraceItemID
        FROM SLE.SaleContractItemTrace AS scit
            JOIN #SaleContractItems AS i
                ON i.SaleContractItemID = scit.SaleContractItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = scit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = scit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = scit.TraceItemID;
    END;
    ELSE IF @engName = 'Order'
    BEGIN

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY oi.RowIndex) AS SMALLINT) RowIndex,
               oi.OrderItemID,
               oi.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               o.Number RequestBaseNumber,
               onr.Non AS MainQuantity,
               CASE
                   WHEN onr.SubQuantity IS NULL THEN
                       NULL
                   ELSE
                       onr.NonSub
               END AS SubQuantity
        INTO #OrderItems
        FROM CTM.OrderItem AS oi
            JOIN CTM.[Order] AS o
                ON o.OrderID = oi.OrderID
            JOIN CTM.Order_Non_Request AS onr
                ON onr.OrderItemID = oi.OrderItemID
            JOIN #vwStuff AS s
                ON s.StuffID = oi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE o.OrderID = @entityId
              AND onr.Non > 0
              AND
              (
                  onr.SubQuantity IS NULL
                  OR onr.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT CAST(5 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               o.BranchID,
               o.FinancialPeriodID,
               [o].[Date] PurchaseRequestDate
        FROM CTM.[Order] AS o
        WHERE o.OrderID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.OrderItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #OrderItems AS i;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
               oit.TraceID,
               oit.DlID,
               d.Code DlCode,
               CASE
                   WHEN oit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       oit.Value
               END Value,
               oit.Version,
               oit.Creator,
               oit.CreationDate,
               oit.LastEditor,
               oit.LastEditionDate,
               oit.TraceItemID
        FROM CTM.OrderItemTrace AS oit
            JOIN #OrderItems AS i
                ON i.OrderItemID = oit.OrderItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = oit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = oit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = oit.TraceItemID;
    END;
    ELSE IF @engName = 'StuffRequest'
    BEGIN

	select * into #StuffRequest_Remains
	from REQ.StuffRequest_Remains

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY oi.StuffRequestItemIndex) AS SMALLINT) RowIndex,
               oi.StuffRequestItemID,
               oi.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               o.StuffRequestNumber AS RequestBaseNumber,
               onr.Non AS MainQuantity,
               CASE
                   WHEN onr.NonSub IS NULL THEN
                       NULL
                   ELSE
                       onr.NonSub
               END AS SubQuantity,
               oi.[Description],
               oi.Description2
        INTO #StuffRequestItems
        FROM REQ.StuffRequestItem AS oi
            JOIN REQ.StuffRequest AS o
                ON o.StuffRequestID = oi.StuffRequestID
            JOIN #StuffRequest_Remains AS onr
                ON onr.StuffRequestItemID = oi.StuffRequestItemID
            JOIN #vwStuff AS s
                ON s.StuffID = oi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE o.StuffRequestID = @entityId
              AND onr.Non > 0
              AND
              (
                  onr.NonSub IS NULL
                  OR onr.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT CAST(2 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               o.BranchID,
               o.FinancialPeriodID,
               CASE
                   WHEN
                   (
                       SELECT ods.SettingValue
                       FROM CFG.OriginDestinationSetting AS ods
                           JOIN MDT.DmdEntity AS m
                               ON m.Id = ods.OriginID
                           JOIN MDT.DmdEntity AS m2
                               ON m2.Id = ods.DestinationID
                       WHERE m.Name = 'StuffRequest'
                             AND m2.Name = 'PurchaseRequest'
                             AND ods.SettingKey = 'Date'
                   ) = 1 THEN
                       o.StuffRequestDate
                   ELSE
                       o.StuffRequestDate
               END AS PurchaseRequestDate,
               o.OrganizationUnitID
        FROM REQ.StuffRequest AS o
        WHERE o.StuffRequestID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.StuffRequestItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.Description,
               i.Description2
        FROM #StuffRequestItems AS i;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
               oit.TraceID,
               oit.DlID,
               d.Code DlCode,
               CASE
                   WHEN oit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       oit.Value
               END Value,
               oit.Version,
               oit.Creator,
               oit.CreationDate,
               oit.LastEditor,
               oit.LastEditionDate,
               oit.TraceItemID
        FROM REQ.StuffRequestItemTrace AS oit
            JOIN #StuffRequestItems AS i
                ON i.StuffRequestItemID = oit.StuffRequestItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = oit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = oit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = oit.TraceItemID;
    END;
    ELSE IF @engName = 'ProductionAnalysis'
    BEGIN

        SELECT CAST(0 AS TINYINT) BaseDocument,
				-1 AS PurchaseRequestID,
               -1 AS BranchID,
               FinancialPeriodID,
               Date PurchaseRequestDate,
               NULL OrganizationUnitID
        FROM PRM.ProductionAnalysis
        WHERE ProductionAnalysisID = @entityId;

        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
				-1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               NULL StuffRequestItemID,
               i.StuffID,
               s.Code StuffCode,
               s.Title StuffTitle,
               mu.Title MainUnit,
               NULL RequestBaseNumber,
               i.ProductionOrder MainQuantity,
               NULL SubQuantity,
               i.ProductionOrder AcceptRequestMainMeasureQuantity,
               NULL AcceptRequestSubMeasureQuantity,
               i.ProductionOrder OrgMainQuantity,
               GETDATE() CreationDate,
               NULL OrgSubQuantity
        FROM PRM.RequiredMaterial i
            JOIN #vwStuff s
                ON s.StuffID = i.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE i.ProductionAnalysisID = @entityId
              AND i.ProductionOrder > 0;

        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS PurchaseRequestItemTraceID,
               CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
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
        FROM PRM.RequiredMaterialTrace AS jit
            JOIN PRM.RequiredMaterial AS i
                ON i.RequiredMaterialID = jit.RequiredMaterialID
            JOIN #TraceIds AS ti
                ON ti.TraceID = jit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = jit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = jit.TraceItemID
        WHERE i.ProductionAnalysisID = @entityId
              AND i.ProductionOrder > 0;
    END;
    ELSE IF @engName = 'ServiceRequest'
    BEGIN

       SELECT CAST(ROW_NUMBER() OVER (ORDER BY oi.RowIndex) AS SMALLINT) RowIndex,
               oi.ServiceRequestItemID,
               oi.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               o.Number AS RequestBaseNumber,
               oi.Quantity - ISNULL(UsedItems.Used, 0)  AS MainQuantity,
               NULL AS SubQuantity,
               oi.[Description],
               oi.Description2
        INTO #ServiceRequestItems
        FROM REQ.ServiceRequestItem AS oi
            JOIN REQ.ServiceRequest AS o on oi.ServiceRequestID = o.ServiceRequestID
            JOIN #vwStuff AS s
                ON s.StuffID = oi.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            LEFT JOIN (
                SELECT sri.ServiceRequestItemID , SUM(pri.MainQuantity) AS Used FROM REQ.ServiceRequestItem sri
                JOIN REQ.PurchaseRequestItem pri on sri.ServiceRequestItemID = pri.ServiceRequestItemID
                GROUP BY sri.ServiceRequestItemID
            ) AS UsedItems 
            ON UsedItems.ServiceRequestItemID = oi.ServiceRequestItemID
        WHERE o.ServiceRequestID = @entityId;

        SELECT CAST(10 AS TINYINT) BaseDocument,
			   -1 AS PurchaseRequestID,
               sr.BranchID,
               sr.FinancialPeriodID,
               GETDATE() PurchaseRequestDate,
               sr.OrganizationUnitID
        FROM REQ.ServiceRequest sr
        WHERE ServiceRequestID = @entityId;
                
        SELECT CAST(-i.RowIndex AS INT) AS PurchaseRequestItemID,
               -1 AS PurchaseRequestID,
               i.RowIndex PurchaseRequestItemIndex,
               i.ServiceRequestItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.MainUnit,
               CAST(i.RequestBaseNumber AS NVARCHAR(50)) RequestBaseNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AcceptRequestMainMeasureQuantity,
               i.SubQuantity AcceptRequestSubMeasureQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.Description,
               i.Description2
        FROM #ServiceRequestItems AS i
        WHERE MainQuantity > 0;

    END;

END;
