CREATE   PROCEDURE [AST].GetDepreciationInfo
(
	@FinancialPeriod int,
	@Date Date = null,			-- محاسبه دوره‌ای: پایان دوره استهلاک | عملیات (خروج، اسقاط، فروش، ارسال به شعبه، تغییر گروه، تجدید ارزیابی): خالی (تاریخ همان سند ملاک است)
	@Subject tinyint,			-- 1: محاسبه دوره‌ای، 2: خروج، 3: اسقاط، 4: فروش، 5: ارسال به شعبه، 6: تغییر گروه، 7: تجدید ارزیابی
	@DocumentID int = null,		-- شناسه سند عملیات (برای Subject های 2 تا 7)
	@BranchID int = null,
	@ErrorTable NVARCHAR(400)
)
--WITH ENCRYPTION
AS

-- خروجی: جدول موقت #Depreciation_Temp (یک ردیف به ازای هر دارایی/جزء/وضعیت) که باید توسط فراخوان (DoDepreciation) ساخته شده باشد،
-- و جدول خطاها (@ErrorTable)
-- همه کنترل‌ها و محاسبات فقط روی داراییهای مربوط به همین محاسبه (#Scope) انجام می‌شود
	EXEC (N'CREATE TABLE ' + @ErrorTable + N'([Message] NVARCHAR(MAX), IsDetail BIT)')

	-- Shared by all validation checks below; flushed to @ErrorTable by the check that fails
	CREATE TABLE #Msg ([Message] NVARCHAR(MAX), IsDetail BIT)

	DECLARE @StartDate DATE,
			@EndDate DATE,
			@Depreciation tinyint

	SELECT @StartDate = StartDate,
		   @EndDate = EndDate
	FROM CFG.FinancialPeriod
	WHERE FinancialPeriodID = @FinancialPeriod

	-- @Depreciation = 1 از تاریخ بهره وری
	-- @Depreciation = 2 از شروع ماه بعد
	SELECT @Depreciation = ConfigValue
	FROM cfg.Configuration
	WHERE ConfigKey = 'Depreciation'

	SELECT * INTO #vwBranchAccess
	FROM cfg.vwBranchAccess AS vba

	DECLARE @StartDateMinusOne DATE = DATEADD(DAY, -1, @StartDate)


	-------------------------------------------------------------------------------
	-- ۱) داراییهای سند عملیات
	-------------------------------------------------------------------------------
	CREATE TABLE #DocAsset
	(
		AssetID int PRIMARY KEY,
		DocDate date NOT NULL
	)

	IF @Subject IN (2, 3, 4, 5, 6, 7)
		INSERT INTO #DocAsset (AssetID, DocDate)
		SELECT x.AssetID, x.DocDate
		FROM
		(
			SELECT i.AssetID, h.Date AS DocDate
			FROM ast.DestructionItem i
			JOIN ast.Destruction h ON h.DestructionID = i.DestructionID
			WHERE @Subject = 2 AND h.FinancialPeriodID = @FinancialPeriod AND h.DestructionID = @DocumentID

			UNION

			SELECT i.AssetID, h.Date
			FROM ast.SalvageItem i
			JOIN ast.Salvage h ON h.SalvageID = i.SalvageID
			WHERE @Subject = 3 AND h.FinancialPeriodID = @FinancialPeriod AND h.SalvageID = @DocumentID

			UNION

			SELECT i.AssetID, h.Date
			FROM ast.SaleItem i
			JOIN ast.Sale h ON h.SaleID = i.SaleID
			WHERE @Subject = 4 AND h.FinancialPeriodID = @FinancialPeriod AND h.SaleID = @DocumentID

			UNION

			SELECT i.AssetID, h.Date
			FROM ast.TransferItem i
			JOIN ast.Transfer h ON h.TransferID = i.TransferID
			WHERE @Subject = 5 AND h.FinancialPeriodID = @FinancialPeriod AND h.TransferID = @DocumentID	
			UNION

			SELECT i.AssetID, h.Date
			FROM ast.ChangeCategoryItem i
			JOIN ast.ChangeCategory h ON h.ChangeCategoryID = i.ChangeCategoryID
			WHERE @Subject = 6 AND h.FinancialPeriodID = @FinancialPeriod AND h.ChangeCategoryID = @DocumentID		

			UNION

			SELECT i.AssetID, h.Date
			FROM ast.RevaluationItem i
			JOIN ast.Revaluation h ON h.RevaluationID = i.RevaluationID
			WHERE @Subject = 7 AND h.FinancialPeriodID = @FinancialPeriod AND h.RevaluationID = @DocumentID


		) x


	-------------------------------------------------------------------------------
	-- ۲) کنترل بها: محاسبه دوره‌ای فقط برای داراییهای شعبه مورد محاسبه (و فقط در آخرین دوره سال مالی)،
	--    عملیات فقط برای داراییهای همان سند
	-------------------------------------------------------------------------------
	CREATE TABLE #NoBaseValue (AssetID int, Plaque nvarchar(200))

	IF @Subject = 1
	BEGIN
		IF @Date = @EndDate
			INSERT INTO #NoBaseValue (AssetID, Plaque)
			SELECT a.AssetID, a.Plaque
			FROM ast.Asset a
			WHERE a.Status = 1
				AND a.CreationDate<=@Date
				AND (@BranchID IS NULL OR a.BranchID = @BranchID)
				AND EXISTS (SELECT 1 FROM #vwBranchAccess v WHERE v.BranchID = a.BranchID)
				AND (a.BaseValue IS NULL OR a.BaseValue = 0
					 OR NOT EXISTS (SELECT 1 FROM ast.AssetSetting s WHERE s.AssetID = a.AssetID AND s.ParentID IS NULL))
	END
	ELSE
		INSERT INTO #NoBaseValue (AssetID, Plaque)
		SELECT a.AssetID, a.Plaque
		FROM #DocAsset d
		JOIN ast.Asset a ON a.AssetID = d.AssetID
		WHERE a.BaseValue IS NULL OR a.BaseValue = 0
			  OR NOT EXISTS (SELECT 1 FROM ast.AssetSetting s WHERE s.AssetID = a.AssetID AND s.ParentID IS NULL)

	IF EXISTS (SELECT 1 FROM #NoBaseValue)
	BEGIN
		INSERT INTO #Msg ([Message], IsDetail)
		VALUES (N'AssetManager.Messages.SomeAssetsHasNotBaseValue', 0)

		INSERT INTO #Msg ([Message], IsDetail)
		SELECT DISTINCT
			   CASE WHEN @Subject = 1 THEN N'Plaque: ' + n.Plaque
					ELSE N'AssetManager.Messages.AssetWithoutBaseValue^' + CAST(n.AssetID AS NVARCHAR(20)) + N',' + n.Plaque
			   END,
			   1
		FROM #NoBaseValue n

		EXEC (N'INSERT INTO ' + @ErrorTable + N' SELECT [Message], IsDetail FROM #Msg')

		RETURN
	END


	-------------------------------------------------------------------------------
	-- ۳) دامنه محاسبه: فقط داراییهایی که باید همین الان برایشان استهلاک محاسبه شود
	--    OutDate = تاریخ سند عملیات (برای محاسبه دوره‌ای خالی)
	-------------------------------------------------------------------------------
	CREATE TABLE #Scope
	(
		AssetID int PRIMARY KEY,
		OutDate date NULL
	)

	IF @Subject = 1
		-- محاسبه دوره‌ای: داراییهای فعال شعبه که تا پایان دوره هنوز استهلاکی برایشان ثبت نشده است
		INSERT INTO #Scope (AssetID, OutDate)
		SELECT a.AssetID, NULL
		FROM ast.Asset a
			 JOIN ast.fnAssetStatusAtDate(@Date, DEFAULT) f ON f.AssetID = a.AssetID
		-- status at the calculation date: an asset with an operation (exit, salvage, sale, transfer) after @Date is still active at @Date
		WHERE f.IsActive = 1
			AND (a.Status = 1 OR f.NextOperationDate IS NOT NULL)
			AND (@BranchID IS NULL OR a.BranchID = @BranchID)
			AND EXISTS (SELECT 1 FROM #vwBranchAccess v WHERE v.BranchID = a.BranchID)
			AND NOT EXISTS (SELECT 1 FROM ast.Depreciation d WHERE d.AssetID = a.AssetID AND d.Date >= @Date)
	ELSE
		-- عملیات: داراییهای همان سند که وضعیتشان با نوع عملیات می‌خواند و در تاریخ سند استهلاکی نخورده‌اند
		INSERT INTO #Scope (AssetID, OutDate)
		SELECT a.AssetID, o.DocDate
		FROM #DocAsset o
		JOIN ast.Asset a ON a.AssetID = o.AssetID
		WHERE (   (@Subject = 2 AND a.Status = 2)
			   OR (@Subject = 3 AND a.Status = 4)
			   OR (@Subject = 4 AND a.Status IN (3, 6))
			   OR (@Subject = 5 AND a.Status = 7)
			   OR (@Subject = 6 AND a.Status = 1)
				   OR (@Subject = 7 AND a.Status = 1))
			AND (@BranchID IS NULL OR a.BranchID = @BranchID)
			AND EXISTS (SELECT 1 FROM #vwBranchAccess v WHERE v.BranchID = a.BranchID)
			AND NOT EXISTS (SELECT 1 FROM ast.Depreciation d WHERE d.AssetID = o.AssetID AND d.Date = o.DocDate)


	-------------------------------------------------------------------------------
	-- Accounting status check: an asset with BaseValue > 0 must have AccountingStatus = 2,
	-- otherwise depreciation cannot be calculated. Only assets of this calculation (#Scope) are checked.
	-------------------------------------------------------------------------------
	IF EXISTS (SELECT 1
			   FROM #Scope s
			   JOIN ast.Asset a ON a.AssetID = s.AssetID
			   WHERE a.BaseValue > 0 AND ISNULL(a.AccountingStatus, 0) <> 2
			  AND a.AssetCreationDate <= ISNULL(@Date, s.OutDate))
	BEGIN
		INSERT INTO #Msg ([Message], IsDetail)
		VALUES (N'AssetManager.Messages.SomeAssetsHasNotConfirmed', 0)

		INSERT INTO #Msg ([Message], IsDetail)
		SELECT DISTINCT
			   CASE WHEN @Subject = 1 THEN N'Plaque: ' + a.Plaque
					ELSE N'AssetManager.Messages.AssetsNotConfirmed^' + CAST(a.AssetID AS NVARCHAR(20)) + N',' + a.Plaque
			   END,
			   1
		FROM #Scope s
		JOIN ast.Asset a ON a.AssetID = s.AssetID
		WHERE a.BaseValue > 0 AND ISNULL(a.AccountingStatus, 0) <> 2
			  AND a.AssetCreationDate <= ISNULL(@Date, s.OutDate)

		EXEC (N'INSERT INTO ' + @ErrorTable + N' SELECT [Message], IsDetail FROM #Msg')

		RETURN
	END

	-------------------------------------------------------------------------------
	-- ۴) مشخصات دارایی: تاریخ شروع استهلاک، تاریخ مبنا (AsOfDate) و عمر باقیمانده در ابتدای سال مالی
	--    AsOfDate = پایان دوره (محاسبه دوره‌ای) یا تاریخ سند (عملیات)
	-------------------------------------------------------------------------------
	CREATE TABLE #Asset
	(
		AssetID int PRIMARY KEY,
		BaseValue decimal(30,4),
		SalvageValue decimal(30,4),
		AccumulatedDepreciation decimal(30,4),
		Plaque nvarchar(200),
		Title nvarchar(1024),
		Title2 nvarchar(1024),
		BranchID int,
		DepreciationMethod tinyint,
		DepreciationRate decimal(18,6),
		OutDate date,
		AsOfDate date,
		EffectiveDate date,
		RemainingLifeTime int,
		LifeStartDate date,
		LifeRefDate date,
		LifeCapDate date
	)

	INSERT INTO #Asset
		(AssetID, BaseValue, SalvageValue, AccumulatedDepreciation, Plaque, Title, Title2, BranchID,
		 DepreciationMethod, DepreciationRate, OutDate, AsOfDate, EffectiveDate, LifeStartDate, LifeRefDate, LifeCapDate)
	SELECT x.AssetID, x.BaseValue, x.SalvageValue, x.AccumulatedDepreciation, x.Plaque, x.Title, x.Title2, x.BranchID,
		   x.DepreciationMethod, x.DepreciationRate, x.OutDate, x.AsOfDate, x.EffectiveDate, x.LifeStartDate,
		   -- the date the remaining life is counted to, and the date the end of the useful life is counted from
		   CASE WHEN x.EffectiveDate <> x.LifeStartDate THEN x.AssetCreationDate WHEN x.LifeStartDate < @StartDate THEN @StartDate ELSE x.LifeStartDate END,
		   CASE WHEN x.EffectiveDate <> x.LifeStartDate THEN DATEADD(DAY, -1, x.AssetCreationDate) ELSE @StartDateMinusOne END
	FROM
	(
		-- an asset received from another branch (Nature = 3) in this financial year is a new asset: it starts at its creation date,
		-- the useful life continues from the original utilization date (LifeStartDate)
		SELECT y.*,
			   CASE WHEN y.IsReceived = 1 AND y.LifeStartDate < y.AssetCreationDate THEN y.AssetCreationDate ELSE y.LifeStartDate END AS EffectiveDate
		FROM
		(
		SELECT a.AssetID, a.BaseValue, a.SalvageValue,
			   a.AccumulatedDepreciation + CASE WHEN a.AssetCreationDate < @StartDate OR a.Nature = 3 THEN a.DuringDepreciation ELSE 0 END AS AccumulatedDepreciation,
			   a.Plaque, a.Title, a.Title2, a.BranchID, a.DepreciationMethod, a.DepreciationRate,
			   s.OutDate,
			   ISNULL(@Date, s.OutDate) AS AsOfDate,
			   CASE @Depreciation
					WHEN 1 THEN a.UtilizationDate
					WHEN 2 THEN DATEADD(DAY, 1, m.LastDayOfMonth)	-- اولین روز ماه بعد از تاریخ بهره وری
			   END AS LifeStartDate,
			   a.AssetCreationDate,
			   CASE WHEN a.Nature = 3 AND a.AssetCreationDate >= @StartDate THEN 1 ELSE 0 END AS IsReceived
		FROM #Scope s
		JOIN ast.Asset a ON a.AssetID = s.AssetID
		JOIN ast.AssetCategory c ON c.AssetCategoryID = a.AssetCategoryID
		LEFT JOIN cfg.DimDate dd ON dd.[Date] = a.UtilizationDate
		OUTER APPLY
		(
			SELECT MAX(d2.FullDateAlternateKey) AS LastDayOfMonth
			FROM cfg.DimDate d2
			WHERE d2.PersianCalendarYear = dd.PersianCalendarYear
				AND d2.PersianMonthNumberOfYear = dd.PersianMonthNumberOfYear
		) m
		WHERE a.AssetCreationDate <= ISNULL(@Date, s.OutDate)
		) y
	) x
	WHERE x.EffectiveDate <= @EndDate
		AND x.EffectiveDate <= x.AsOfDate

	UPDATE #Asset
	SET RemainingLifeTime = CFG.DaySpace(DepreciationRate, LifeStartDate) - DATEDIFF(DAY, LifeStartDate, LifeRefDate)


	-------------------------------------------------------------------------------
	-- ۵) اجزای قابل استهلاک هر دارایی: 1 عادی، 2 تعمیر، 3 تغییر بها، 4 مازاد تجدید ارزیابی
	--    (تعمیرات، تغییر بها و تجدید ارزیابی فقط تا تاریخ مبنا)
	-------------------------------------------------------------------------------
	-- استهلاک ثبت شده هر جزء قبل از شروع سال مالی
	SELECT d.AssetID, d.DepreciationType,
		   ISNULL(d.RepairID, 0) AS RepairID,
		   ISNULL(d.AdjustmentItemID, 0) AS AdjustmentItemID,
		   ISNULL(d.RevaluationItemID, 0) AS RevaluationItemID,
		   SUM(d.Value) AS Value
	INTO #PriorDep
	FROM ast.Depreciation d
	JOIN #Asset a ON a.AssetID = d.AssetID
	WHERE d.Date < @StartDate
	GROUP BY d.AssetID, d.DepreciationType, ISNULL(d.RepairID, 0), ISNULL(d.AdjustmentItemID, 0), ISNULL(d.RevaluationItemID, 0)

	CREATE TABLE #IncludedAsset
	(
		Type tinyint,
		AssetID int,
		RepairID int,
		AdjustmentItemID int,
		RevaluationItemID int,
		BaseValue decimal(30,4),
		EffectiveDate date,
		AccumulatedDepreciation decimal(30,4),
		RemainingLifeTime int,
		SalvageValue decimal(30,4),
		DepreciationMethod tinyint,
		DepreciationRate decimal(5,2),
		Plaque nvarchar(200),
		Title nvarchar(1024),
		Title2 nvarchar(1024),
		BranchID int,
		OutDate date,
		AsOfDate date
	)

	INSERT INTO #IncludedAsset
		(Type, AssetID, RepairID, AdjustmentItemID, RevaluationItemID, BaseValue, EffectiveDate, AccumulatedDepreciation,
		 RemainingLifeTime, SalvageValue, DepreciationMethod, DepreciationRate, Plaque, Title, Title2, BranchID, OutDate, AsOfDate)
	SELECT c.Type, c.AssetID, c.RepairID, c.AdjustmentItemID, c.RevaluationItemID, c.BaseValue, c.EffectiveDate,
		   c.OpeningAccumulated + ISNULL(p.Value, 0),
		   a.RemainingLifeTime, c.SalvageValue, a.DepreciationMethod, ISNULL(a.DepreciationRate, 0),
		   a.Plaque, a.Title, a.Title2, a.BranchID, a.OutDate, a.AsOfDate
	FROM
	(
		-- عادی
		SELECT 1 AS Type, a.AssetID,
			   CAST(NULL AS int) AS RepairID, CAST(NULL AS int) AS AdjustmentItemID, CAST(NULL AS int) AS RevaluationItemID,
			   a.BaseValue, a.EffectiveDate, a.AccumulatedDepreciation AS OpeningAccumulated, a.SalvageValue
		FROM #Asset a
		WHERE a.DepreciationMethod <> 3

		UNION ALL

		-- تعمیر
		SELECT 2, a.AssetID, r.RepairID, NULL, NULL,
			   ISNULL(rs.Price, 0) + ISNULL(rt.Price, 0), r.Date, 0, 0
		FROM #Asset a
		JOIN ast.Repair r ON r.AssetID = a.AssetID
		LEFT JOIN (SELECT RepairID, SUM(Price) AS Price FROM ast.RepairServiceCost GROUP BY RepairID) rs ON rs.RepairID = r.RepairID
		LEFT JOIN (SELECT RepairID, SUM(Price) AS Price FROM ast.RepairStuffCost GROUP BY RepairID) rt ON rt.RepairID = r.RepairID
		WHERE a.DepreciationMethod <> 3
			AND r.Type = 2
			AND r.Date <= a.AsOfDate

		UNION ALL

		-- تغییر بها
		SELECT 3, a.AssetID, NULL, ai.AdjustmentItemID, NULL,
			   ai.Amount, adj.Date, 0, 0
		FROM #Asset a
		JOIN ast.AdjustmentItem ai ON ai.AssetID = a.AssetID
		JOIN ast.Adjustment adj ON adj.AdjustmentID = ai.AdjustmentID
		WHERE a.DepreciationMethod <> 3
			AND adj.Date <= a.AsOfDate

		UNION ALL

		-- مازاد ناشی از تجدید ارزیابی
		SELECT 4, a.AssetID, NULL, NULL, ri.RevaluationItemID,
			   ri.Value, rv.Date, 0, 0
		FROM #Asset a
		JOIN ast.RevaluationItem ri ON ri.AssetID = a.AssetID
		JOIN ast.Revaluation rv ON rv.RevaluationID = ri.RevaluationID
		WHERE a.DepreciationMethod <> 3
			AND rv.Date <= a.AsOfDate
	) c
	JOIN #Asset a ON a.AssetID = c.AssetID
	LEFT JOIN #PriorDep p ON p.AssetID = c.AssetID
						 AND p.DepreciationType = c.Type
						 AND p.RepairID = ISNULL(c.RepairID, 0)
						 AND p.AdjustmentItemID = ISNULL(c.AdjustmentItemID, 0)
						 AND p.RevaluationItemID = ISNULL(c.RevaluationItemID, 0)

	-- اجزایی که استهلاک آنها کامل شده است حذف می‌شوند
	SELECT d.AssetID, d.DepreciationType,
		   ISNULL(d.RepairID, 0) AS RepairID,
		   ISNULL(d.AdjustmentItemID, 0) AS AdjustmentItemID,
		   ISNULL(d.RevaluationItemID, 0) AS RevaluationItemID,
		   SUM(d.Value) AS DepreciationUpToNow
	INTO #YearDep
	FROM ast.Depreciation d
	JOIN #Asset a ON a.AssetID = d.AssetID
	WHERE d.FinancialPeriodID = @FinancialPeriod
	GROUP BY d.AssetID, d.DepreciationType, ISNULL(d.RepairID, 0), ISNULL(d.AdjustmentItemID, 0), ISNULL(d.RevaluationItemID, 0)

	DELETE i
	FROM #IncludedAsset i
	LEFT JOIN #YearDep y ON y.AssetID = i.AssetID
						AND y.DepreciationType = i.Type
						AND y.RepairID = ISNULL(i.RepairID, 0)
						AND y.AdjustmentItemID = ISNULL(i.AdjustmentItemID, 0)
						AND y.RevaluationItemID = ISNULL(i.RevaluationItemID, 0)
	WHERE i.BaseValue - i.AccumulatedDepreciation - i.SalvageValue - ISNULL(y.DepreciationUpToNow, 0) = 0


	-------------------------------------------------------------------------------
	-- ۶) بازه‌های زمانی هر جزء بر اساس تغییر وضعیت دارایی (AssetSetting)
	-------------------------------------------------------------------------------
	-- آخرین تاریخ استهلاک ثبت شده هر وضعیت
	SELECT d.AssetSettingID, MAX(d.Date) AS Date
	INTO #MaxDateDepreciation
	FROM ast.Depreciation d
	JOIN #Asset a ON a.AssetID = d.AssetID
	GROUP BY d.AssetSettingID

	SELECT x.*
	INTO #Seg
	FROM
	(
		-- آخرین وضعیت سالهای قبل (برای اجزایی که قبل از شروع سال مالی شروع شده‌اند)
		SELECT t.AssetID, t.AssetSettingID, t.StartDate, t.EndDate, t.Status,
			   t.Type, t.RepairID, t.AdjustmentItemID, t.RevaluationItemID,
			   t.BaseValue, t.AccumulatedDepreciation, t.RemainingLifeTime, t.SalvageValue,
			   t.DepreciationMethod, t.DepreciationRate, t.Plaque, t.Title, t.Title2, t.BranchID
		FROM
		(
			SELECT s1.AssetID, s1.AssetSettingID, @StartDate AS StartDate,
				   CASE WHEN s2.Date IS NOT NULL AND s2.Date < a.AsOfDate THEN s2.Date ELSE a.AsOfDate END AS EndDate,
				   DATEDIFF(DAY, @StartDate, ISNULL(s2.Date, a.AsOfDate)) AS DaysCount,
				   s1.Status,
				   a.Type, a.RepairID, a.AdjustmentItemID, a.RevaluationItemID,
				   a.BaseValue, a.AccumulatedDepreciation, a.RemainingLifeTime, a.SalvageValue,
				   a.DepreciationMethod, a.DepreciationRate, a.Plaque, a.Title, a.Title2, a.BranchID,
				   ROW_NUMBER() OVER (PARTITION BY s1.AssetID, a.Type, COALESCE(a.RepairID, a.AdjustmentItemID, a.RevaluationItemID)
									  ORDER BY s1.Date DESC) AS Rno
			FROM ast.AssetSetting s1
			JOIN #IncludedAsset a ON a.AssetID = s1.AssetID
			LEFT JOIN ast.AssetSetting s2 ON s2.ParentID = s1.AssetSettingID
			LEFT JOIN #MaxDateDepreciation md ON md.AssetSettingID = s1.AssetSettingID
			WHERE a.EffectiveDate < @StartDate
				AND s1.Date < @StartDate
				AND (s2.AssetSettingID IS NULL OR md.Date IS NULL OR s2.Date > md.Date)
		) t
		WHERE t.Rno = 1
			AND t.DaysCount > 0

		UNION ALL

		-- وضعیتهای سال جاری
		SELECT s1.AssetID, s1.AssetSettingID,
			   CASE WHEN a.EffectiveDate >= s1.Date THEN a.EffectiveDate ELSE s1.Date END AS StartDate,
			   CASE WHEN s2.Date IS NOT NULL AND s2.Date < a.AsOfDate THEN s2.Date ELSE a.AsOfDate END AS EndDate,
			   s1.Status,
			   a.Type, a.RepairID, a.AdjustmentItemID, a.RevaluationItemID,
			   a.BaseValue, a.AccumulatedDepreciation, a.RemainingLifeTime, a.SalvageValue,
			   a.DepreciationMethod, a.DepreciationRate, a.Plaque, a.Title, a.Title2, a.BranchID
		FROM ast.AssetSetting s1
		JOIN #IncludedAsset a ON a.AssetID = s1.AssetID
		LEFT JOIN ast.AssetSetting s2 ON s2.ParentID = s1.AssetSettingID
		LEFT JOIN #MaxDateDepreciation md ON md.AssetSettingID = s1.AssetSettingID
		WHERE (a.EffectiveDate >= @StartDate OR s1.Date BETWEEN @StartDate AND a.AsOfDate)
			AND (s2.AssetSettingID IS NULL OR md.Date IS NULL OR s2.Date > md.Date)
			AND DATEDIFF(DAY, s1.Date, ISNULL(s2.Date, a.AsOfDate)) > 0
	) x


	-------------------------------------------------------------------------------
	-- ۷) خروجی: اولین بازه هر دارایی یک روز زودتر شروع می‌شود (محاسبه روز شروع)
	--    و مدت زمان هر بازه (AssetsSettingLifeTime) و کامل شدن استهلاک (FullyDepreciate) محاسبه می‌شود
	-------------------------------------------------------------------------------
	;WITH S AS
	(
		SELECT x.*,
			   CASE WHEN ROW_NUMBER() OVER (PARTITION BY x.AssetID ORDER BY x.StartDate, x.Type, x.AssetSettingID) = 1
					THEN DATEADD(DAY, -1, x.StartDate)
					ELSE x.StartDate
			   END AS FinalStartDate
		FROM #Seg x
	)
	INSERT INTO #Depreciation_Temp
		(AssetID, Plaque, Title, Title2, StartDate, EndDate, BranchID, AssetSettingID, DepreciationMethod, DepreciationRate,
		 Status, BaseValue, AccumulatedDepreciation, RemainingLifeTime, SalvageValue, DepreciationType,
		 RepairID, AdjustmentItemID, RevaluationItemID, Depreciation, AssetsSettingLifeTime, FullyDepreciate)
	SELECT S.AssetID, S.Plaque, S.Title, S.Title2, S.FinalStartDate, S.EndDate, S.BranchID, S.AssetSettingID, S.DepreciationMethod, S.DepreciationRate,
		   S.Status, S.BaseValue, S.AccumulatedDepreciation, S.RemainingLifeTime, S.SalvageValue, S.Type,
		   S.RepairID, S.AdjustmentItemID, S.RevaluationItemID, 0,
		   CASE WHEN S.DepreciationMethod = 1 THEN DATEDIFF(DAY, S.FinalStartDate, S.EndDate)
				WHEN S.DepreciationMethod = 2 THEN CASE WHEN L.Life > S.RemainingLifeTime THEN S.RemainingLifeTime ELSE L.Life END
		   END,
		   CASE WHEN S.DepreciationMethod = 2 AND DATEADD(DAY, S.RemainingLifeTime, S.FinalStartDate) <= S.EndDate THEN 1 ELSE 0 END
	FROM S
	JOIN #Asset ca ON ca.AssetID = S.AssetID
	CROSS APPLY
	(
		-- مستقیم دارای عمر مفید: از ابتدای بازه تا پایان بازه یا پایان عمر مفید (هر کدام زودتر)
		SELECT DATEDIFF(DAY, S.FinalStartDate,
						CASE WHEN DATEADD(DAY, S.RemainingLifeTime, ca.LifeCapDate) < S.EndDate
							 THEN DATEADD(DAY, S.RemainingLifeTime, ca.LifeCapDate)
							 ELSE S.EndDate END) AS Life
	) L


