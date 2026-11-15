
CREATE   PROC PRM.spGetOtherCost
 @CostCalculationPeriodID INT
AS
BEGIN
	DECLARE @error TABLE (
		[Message] NVARCHAR(MAX) ,
		IsDetail BIT
	)

	declare @CalculationDate date
	select @CalculationDate = EndDate from prm.CostCalculationPeriod
	where CostCalculationPeriodID = @CostCalculationPeriodID

	DECLARE @Message NVARCHAR(MAX),
			@Detail NVARCHAR(MAX);

	select ROW_NUMBER() over(partition by cdcs.coststructureid order by cp.EndDate desc) rno,
			cdcs.CostCalculationPeriodID,cdcs.CostStructureID,
			cdcs.CostDataCollectionSettingID
	into #CostDataCollectionSetting
	from prm.CostDataCollectionSetting cdcs
		join prm.CostCalculationPeriod cp on cdcs.CostCalculationPeriodID = cp.CostCalculationPeriodID
	where cp.EndDate<=@CalculationDate

	SELECT a.CostStructureID,
		   c.SlID,
		   2 ApportionBaseType  -- c.CostDriverID    removed from table #2713
	INTO #CostStructure
	FROM #CostDataCollectionSetting a
		JOIN PRM.CostDataCollectionAccountSetting c
			ON c.CostDataCollectionSettingID = a.CostDataCollectionSettingID
			where a.rno = 1;

	SELECT v.VoucherID
	INTO #Voucher
	FROM ACC.Voucher AS v
		JOIN PRM.CostCalculationPeriod AS ccp
			ON v.Date
			   BETWEEN ccp.StartDate AND ccp.EndDate
	WHERE ccp.CostCalculationPeriodID = @CostCalculationPeriodID;

	DELETE FROM PRM.OtherCost
	WHERE CostCalculationPeriodID = @CostCalculationPeriodID;

	INSERT INTO PRM.OtherCost
	SELECT @CostCalculationPeriodID,
		   cc.CostCenterID,
		   cs.CostStructureID,
		   cs.SlID,
		   cs.ApportionBaseType,
		   SUM(vi.Debit - vi.Credit) Cost
	FROM #Voucher AS v
	JOIN ACC.VoucherItem AS vi
		ON v.VoucherID = vi.VoucherID
	JOIN #CostStructure cs
		ON cs.SlID = vi.SlID
	JOIN ACC.AccountLevelVoucherItem alvi
		ON alvi.VoucherItemID = vi.VoucherItemID
	JOIN CFG.CostCenter cc
		ON cc.DlID = alvi.DlID
	where cc.CostCenterType = 1
	GROUP BY cc.CostCenterID,
			 cs.CostStructureID,
			 cs.SlID,
			 cs.ApportionBaseType;

	SELECT a.CostCenterId
	INTO #CostCentersNotInPeriodProduction
	FROM PRM.OtherCost a
		LEFT JOIN PRM.PeriodProduction b
			ON a.CostCenterId = b.CostCenterId
			   AND b.CostCalculationPeriodID = @CostCalculationPeriodID
	WHERE a.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND b.PeriodProductionID IS NULL
		  and a.Cost<>0
	GROUP BY a.CostCenterId;

	IF EXISTS (SELECT 1 FROM #CostCentersNotInPeriodProduction)
	BEGIN
		DECLARE @CostCenter NVARCHAR(20)
		SELECT @CostCenter = [Value]
		FROM cfg.LocalizeEnumValue lv
			JOIN CFG.LocalizeEnum l
				ON lv.LocalizeEnumID = l.LocalizeEnumID
		WHERE l.Enum = N'UtilizationPlace' 
			AND l.Item =	N'CostCenter' 
			AND lv.Culture = cfg.GetuserCulture()

		INSERT @error
		select N'ProductionManagement.Messages.SameCostCentersIncludeCollectingWithProduced', 0

		INSERT @error
		SELECT @CostCenter +N' '+ c.Title , 1
			FROM #CostCentersNotInPeriodProduction a
				JOIN CFG.CostCenter c
					ON c.CostCenterID = a.CostCenterId

		SELECT * FROM @error
		RETURN;
	END;

	DELETE FROM PRM.[PeriodProductionOtherCost]
	WHERE CostCalculationPeriodID = @CostCalculationPeriodID;

	INSERT INTO [PRM].[PeriodProductionOtherCost]
	(
		PeriodProductionID,
		CostStructureID,
		SlID,
		ShareOfCost,
		CostCalculationPeriodID
	)
	SELECT pp.PeriodProductionID,
		   oc.CostStructureID,
		   oc.SlID,
		   oc.Cost / pps.TotalQuantity * pp.Quantity,
		   @CostCalculationPeriodID
	FROM PRM.PeriodProduction pp
		JOIN PRM.OtherCost oc
			ON oc.CostCenterId = pp.CostCenterId
		JOIN
		(
			SELECT CostCenterId,
				   SUM(Quantity) TotalQuantity
			FROM PRM.PeriodProduction
			WHERE CostCalculationPeriodID = @CostCalculationPeriodID
			GROUP BY CostCenterId
		) pps
			ON pps.CostCenterId = pp.CostCenterId
	WHERE pp.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.ApportionBaseType = 4; --تعداد تولید

	INSERT INTO [PRM].[PeriodProductionOtherCost]
	(
		PeriodProductionID,
		CostStructureID,
		SlID,
		ShareOfCost,
		CostCalculationPeriodID
	)
	SELECT pp.PeriodProductionID,
		   oc.CostStructureID,
		   oc.SlID,
		   oc.Cost * pps.MaterialWeight * pp.Quantity
		   / SUM(pps.MaterialWeight * pp.Quantity) OVER (PARTITION BY pp.CostCenterId, oc.SlID),
		   @CostCalculationPeriodID
	FROM PRM.PeriodProduction pp
		JOIN PRM.OtherCost oc
			ON oc.CostCenterId = pp.CostCenterId
		JOIN
		(
			SELECT PeriodProductionID,
				   SUM(Quantity) [MaterialWeight]
			FROM PRM.PeriodProductionBOM
			WHERE CostCalculationPeriodID = @CostCalculationPeriodID
			GROUP BY PeriodProductionID
		) pps
			ON pps.PeriodProductionID = pp.PeriodProductionID
	WHERE pp.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.ApportionBaseType = 3; --وزن مصرف

	SELECT pp.CostCenterId,
		   pp.StuffID
	INTO #NotInProductionTiming
	FROM PRM.PeriodProduction pp
		JOIN PRM.OtherCost oc
			ON oc.CostCenterId = pp.CostCenterId
		LEFT JOIN PRM.ProductionTiming pt
			ON pt.StuffID = pp.StuffID
			   AND pt.CostCenterId = pp.CostCenterId
	WHERE pp.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.ApportionBaseType = 2 --زمان تولید
		  AND pt.ProductionTimingID IS NULL;

	IF EXISTS (SELECT 1 FROM #NotInProductionTiming)
	BEGIN
		INSERT @error 
		SELECT N'ProductionManagement.Messages.WithoutProductionTiming', 0
		INSERT @error 
		SELECT N'ProductionManagement.Messages.StuffInCostCenter^' + b.code + N',' + c.Title, 1
		FROM #NotInProductionTiming a
			JOIN STF.VWStuff b
				ON a.StuffID = b.StuffID
			JOIN CFG.CostCenter c
				ON c.CostCenterID = a.CostCenterId
		SELECT * FROM @error
		RETURN;
	END;

	INSERT INTO [PRM].[PeriodProductionOtherCost]
	(
		PeriodProductionID,
		CostStructureID,
		SlID,
		ShareOfCost,
		CostCalculationPeriodID
	)
	SELECT pp.PeriodProductionID,
		   oc.CostStructureID,
		   oc.SlID,
		   oc.Cost * pt.ProductionTime * pp.Quantity
		   / SUM(pt.ProductionTime * pp.Quantity) OVER (PARTITION BY pp.CostCenterId, oc.SlID),
		   @CostCalculationPeriodID
	FROM PRM.PeriodProduction pp
		JOIN PRM.OtherCost oc
			ON oc.CostCenterId = pp.CostCenterId
		JOIN PRM.ProductionTiming pt
			ON pt.StuffID = pp.StuffID
			   AND pt.CostCenterId = pp.CostCenterId
	WHERE pp.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.CostCalculationPeriodID = @CostCalculationPeriodID
		  AND oc.ApportionBaseType = 2; --زمان تولید

	UPDATE [PRM].[PeriodProductionOtherCost]
	SET ShareOfCost = ROUND(ShareOfCost, 0)
	WHERE CostCalculationPeriodID = @CostCalculationPeriodID;

	UPDATE c
	SET c.ShareOfCost = c.ShareOfCost + diff
	FROM
	(
		SELECT ROW_NUMBER() OVER (PARTITION BY b.CostCenterId, a.SlID ORDER BY a.ShareOfCost DESC) Rno,
			   a.PeriodProductionOtherCostID,
			   b.CostCenterId,
			   a.SlID
		FROM [PRM].PeriodProductionOtherCost a
			JOIN PRM.PeriodProduction b
				ON a.PeriodProductionID = b.PeriodProductionID
		WHERE a.CostCalculationPeriodID = @CostCalculationPeriodID
	) a
		JOIN
		(
			SELECT a.CostCenterId,
				   a.SlID,
				   a.Cost - b.Cost diff
			FROM PRM.OtherCost a
				JOIN
				(
					SELECT a.SlID,
						   b.CostCenterId,
						   SUM(a.ShareOfCost) Cost
					FROM [PRM].PeriodProductionOtherCost a
						JOIN PRM.PeriodProduction b
							ON a.PeriodProductionID = b.PeriodProductionID
					WHERE a.CostCalculationPeriodID = @CostCalculationPeriodID
					GROUP BY a.SlID,
							 b.CostCenterId
				) b
					ON a.SlID = b.SlID
					   AND a.CostCenterId = b.CostCenterId
			WHERE a.CostCalculationPeriodID = @CostCalculationPeriodID
		) b
			ON a.SlID = b.SlID
			   AND a.CostCenterId = b.CostCenterId
		JOIN [PRM].PeriodProductionOtherCost c
			ON c.PeriodProductionOtherCostID = a.PeriodProductionOtherCostID
	WHERE a.Rno = 1
		  AND b.diff <> 0;

	SELECT * FROM @error
END
