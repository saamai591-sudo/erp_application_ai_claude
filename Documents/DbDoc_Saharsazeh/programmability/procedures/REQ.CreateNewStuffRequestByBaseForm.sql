------------------------------------- START #7441
CREATE   PROC [REQ].CreateNewStuffRequestByBaseForm
(
    @engName NVARCHAR(100),
    @entityId INT,
    @type INT = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @Culture NVARCHAR(100),
			@CultureNo TINYINT,
			@UserID INT;

	SET @UserID = CFG.GetuserID();
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
	WHERE dnt.EngName = 'StuffRequest';

	IF @engName = 'ProductionAnalysis'
	BEGIN
		IF @type = 1
		BEGIN

			SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY rmcc.RequiredMaterialCostCenterID) AS INT) AS [StuffRequestItemID],
				   CAST(ROW_NUMBER() OVER (ORDER BY rmcc.RequiredMaterialCostCenterID) AS INT) AS [StuffRequestItemIndex],
				   rm.[StuffID],
				   vrmnr.Non [MainQuantity],
				   NULL [SubQuantity],
				   NULL [Description],
				   NULL [Description2],
				   vrmnr.Non [AcceptRequestMainMeasureQuantity],
				   @UserID AS [Creator],
				   GETDATE() AS [CreationDate],
				   @UserID AS [LastEditor],
				   GETDATE() AS [LastEditionDate],
				   0 [Version],
				   NULL [AcceptRequestSubMeasureQuantity],
				   s.Code StuffCode,
				   s.Title StuffTitle,
				   rm.RequiredMaterialID,
				   rmcc.RequiredMaterialCostCenterID,
				   h.Number RequiredMaterialNumber,
				   rmcc.CostCenterID,
				   cc.Title CostCenterTitle,
				   null as ProjectID
			INTO #T
			FROM PRM.RequiredMaterial rm
				JOIN PRM.RequiredMaterialCostCenter rmcc
					ON rmcc.RequiredMaterialID = rm.RequiredMaterialID
				JOIN CFG.CostCenter cc
					ON cc.CostCenterID = rmcc.CostCenterID
				JOIN STF.VWStuff s
					ON s.StuffID = rm.StuffID
				JOIN PRM.ProductionAnalysis h
					ON h.ProductionAnalysisID = rm.ProductionAnalysisID
				JOIN PRM.vwRequiredMaterialNonRequested AS vrmnr
					ON vrmnr.RequiredMaterialCostCenterID = rmcc.RequiredMaterialCostCenterID
			WHERE h.ProductionAnalysisID = @entityId
			and vrmnr.Non > 0
			
			SELECT -1 AS [BranchID],
				-1 AS StuffRequestID ,
			   0 AS [StuffRequestNumber],
			   Date AS [StuffRequestDate],
			   CAST(0 AS TINYINT) AS [StuffRequestState],
			   @UserID AS [Creator],
			   GETDATE() AS [CreationDate],
			   @UserID AS [LastEditor],
			   GETDATE() AS [LastEditionDate],
			   0 AS [Version],
			   [FinancialPeriodID],
			   NULL [OrganizationUnitID],
			   CAST(CASE
						WHEN @type = 1 THEN
							2
						WHEN @type = 2 THEN
							3
					END AS INT) BaseDocument,
			   CAST(@type AS TINYINT) AS [Type],
				   CASE 
				   WHEN EXISTS (SELECT 1 
								FROM #T 
								WHERE CostCenterID IS NOT NULL) 
				   THEN 2 
				   ELSE 1 
			   END as UtilizationPlace 
		FROM PRM.ProductionAnalysis
		WHERE ProductionAnalysisID = @entityId;
		
			SELECT -1 AS StuffRequestID ,
					[StuffRequestItemID],
				   [StuffRequestItemIndex],
				   [StuffID],
				   [MainQuantity],
				   [SubQuantity],
				   [Description],
				   [Description2],
				   [AcceptRequestMainMeasureQuantity],
				   [Creator],
				   [CreationDate],
				   [LastEditor],
				   [LastEditionDate],
				   [Version],
				   [AcceptRequestSubMeasureQuantity],
				   StuffCode,
				   StuffTitle,
				   RequiredMaterialCostCenterID,
				   RequiredMaterialNumber,
				   CostCenterID,
				   CostCenterTitle,
				   [ProjectID]
			FROM #T;

			SELECT i.[StuffRequestItemID],
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
				JOIN #T AS i
					ON i.RequiredMaterialID = jit.RequiredMaterialID
				JOIN #TraceIds AS ti
					ON ti.TraceID = jit.TraceID
				LEFT JOIN ACC.DL AS d
					ON d.DLID = jit.DlID
				LEFT JOIN STF.TraceItem AS ti2
					ON ti2.TraceItemID = jit.TraceItemID;
		END;
		ELSE
		IF @type = 2
		BEGIN
			SELECT -1 AS StuffRequestID ,
				-1 AS [BranchID],
			   0 AS [StuffRequestNumber],
			   Date AS [StuffRequestDate],
			   CAST(0 AS TINYINT) AS [StuffRequestState],
			   @UserID AS [Creator],
			   GETDATE() AS [CreationDate],
			   @UserID AS [LastEditor],
			   GETDATE() AS [LastEditionDate],
			   0 AS [Version],
			   [FinancialPeriodID],
			   NULL [OrganizationUnitID],
			   CAST(CASE
						WHEN @type = 1 THEN
							2
						WHEN @type = 2 THEN
							3
					END AS INT) BaseDocument,
			   CAST(@type AS TINYINT) AS [Type],
				1 as UtilizationPlace 
			FROM PRM.ProductionAnalysis
			WHERE ProductionAnalysisID = @entityId;

			SELECT CAST(-rm.RowIndex AS INT) AS [StuffRequestItemID],
				   rm.RowIndex AS [StuffRequestItemIndex],
				   rm.[StuffID],
				   vrmnr.Non [MainQuantity],
				   NULL [SubQuantity],
				   NULL [Description],
				   NULL [Description2],
				   rm.RequiredQuantity [AcceptRequestMainMeasureQuantity],
				   @UserID AS [Creator],
				   GETDATE() AS [CreationDate],
				   @UserID AS [LastEditor],
				   GETDATE() AS [LastEditionDate],
				   0 [Version],
				   NULL [AcceptRequestSubMeasureQuantity],
				   s.Code StuffCode,
				   s.Title StuffTitle,
				   rm.RequiredProductID,
				   h.Number RequiredProductNumber,
				   rm.CostCenterId,
				   cc.Title CostCenterTitle,
				   null ProjectID
			INTO #T1
			FROM PRM.RequiredProduct rm
				JOIN CFG.CostCenter cc
					ON cc.CostCenterID = rm.CostCenterId
				JOIN STF.VWStuff s
					ON s.StuffID = rm.StuffID
				JOIN PRM.ProductionAnalysis h
					ON h.ProductionAnalysisID = rm.ProductionAnalysisID
				JOIN PRM.vwRequiredProductNonRequested AS vrmnr
					ON vrmnr.RequiredProductID = rm.RequiredProductID
			WHERE h.ProductionAnalysisID = @entityId
			and vrmnr.Non > 0

			SELECT -1 AS StuffRequestID ,
					[StuffRequestItemID],
				   [StuffRequestItemIndex],
				   [StuffID],
				   [MainQuantity],
				   [SubQuantity],
				   [Description],
				   [Description2],
				   [AcceptRequestMainMeasureQuantity],
				   [Creator],
				   [CreationDate],
				   [LastEditor],
				   [LastEditionDate],
				   [Version],
				   [AcceptRequestSubMeasureQuantity],
				   StuffCode,
				   StuffTitle,
				   RequiredProductID,
				   RequiredProductNumber,
				   CostCenterId,
				   CostCenterTitle,
				   ProjectID
			FROM #T1;

			SELECT i.[StuffRequestItemID],
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
			FROM PRM.RequiredProductTrace AS jit
				JOIN #T1 AS i
					ON i.RequiredProductID = jit.RequiredProductID
				JOIN #TraceIds AS ti
					ON ti.TraceID = jit.TraceID
				LEFT JOIN ACC.DL AS d
					ON d.DLID = jit.DlID
				LEFT JOIN STF.TraceItem AS ti2
					ON ti2.TraceItemID = jit.TraceItemID;
		END;
	END;
	else IF @engName = 'StuffRequest'
	BEGIN
		SELECT -1 as [BranchID]
			  ,StuffRequestDate as [StuffRequestDate]
			  ,cast(0 as tinyint) as [StuffRequestState]
			  ,@UserID as [Creator]
			  ,getdate() as [CreationDate]
			  ,@UserID as [LastEditor]
			  ,getdate() as [LastEditionDate]
			  ,0 as [Version]
			  ,[FinancialPeriodID]
			  ,[OrganizationUnitID]
			  ,4 AS BaseDocument
			  ,[UtilizationPlace] ,
			  r.StuffRequestID
		from req.StuffRequest r
		where StuffRequestID = @entityId

		SELECT 
		       rm.StuffRequestID AS StuffRequestID, 
			   rmcc.StuffRequestItemID
			  , [StuffRequestItemIndex]
			  ,rmcc.[StuffID]
			  ,non.Non  [MainQuantity]
			  ,non.NonSub [SubQuantity]
			  ,null [Description]
			  ,null [Description2]
			  ,non.Non [AcceptRequestMainMeasureQuantity]
			  ,@UserID as [Creator]
			  ,GETDATE() as [CreationDate]
			  ,@UserID as [LastEditor]
			  ,GETDATE() as [LastEditionDate]
			  ,0 [Version]
			  , non.NonSub [AcceptRequestSubMeasureQuantity]
			  ,s.Code StuffCode
			  ,s.Title StuffTitle
			  ,s.Barcode BarCode
			  ,s.MainMeasureUnit MainUnit
			  ,rmcc.StuffRequestItemID BaseStuffRequestItemID
			  ,rm.StuffRequestNumber BaseStuffRequestNumber
			  ,null ProjectID
			  into #T2
		  FROM req.StuffRequest rm
		  join req.StuffRequestItem rmcc on rmcc.StuffRequestID = rm.StuffRequestID
		  join req.StuffRequest_Remains non on non.StuffRequestItemID = rmcc.StuffRequestItemID
		  join stf.VWStuff s
			on s.StuffID = rmcc.StuffID	
		  where rm.StuffRequestID = @entityId
		  and  non.Non   > 0

		  select  [StuffRequestID] ,[StuffRequestItemID],[StuffRequestItemIndex],[StuffID],[MainQuantity],[SubQuantity],
				 [Description],[Description2],[AcceptRequestMainMeasureQuantity],[Creator],
				 [CreationDate],[LastEditor],[LastEditionDate],[Version],[AcceptRequestSubMeasureQuantity],
				 StuffCode,StuffTitle,BarCode,MainUnit,BaseStuffRequestItemID,BaseStuffRequestNumber,[ProjectID]
		  from #T2

		SELECT i.[StuffRequestItemID],
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
		FROM req.StuffRequestItemTrace AS jit
			JOIN #T2 i on i.StuffRequestItemID = jit.StuffRequestItemID
			JOIN #TraceIds AS ti
				ON ti.TraceID = jit.TraceID
			LEFT JOIN ACC.DL AS d
				ON d.DLID = jit.DlID
			LEFT JOIN STF.TraceItem AS ti2
				ON ti2.TraceItemID = jit.TraceItemID


	END;
