
-----------------------------------------

CREATE    PROC VND.SpCalculateTechnicalRate (
	@TenderID INT = NULL,
	@PurchasePlanningID INT = NULL
	)
AS
BEGIN
IF (@PurchasePlanningID IS NULL AND @TenderID IS NOT NULL )
BEGIN
	IF EXISTS (
			SELECT *
			FROM vnd.Tender t
			LEFT JOIN vnd.TenderParticipate a
				ON a.TenderID = t.TenderID
			LEFT JOIN vnd.TenderEvaluation b
				ON a.TenderID = b.TenderID
					AND a.PartyID = b.PartyID
			WHERE t.TenderID = @TenderID
				AND b.TenderEvaluationID IS NULL
			)
	BEGIN
		RAISERROR ('لازم است ابتدا براي تمام شرکت کنندگان، امتياز شاخصها ثبت شود.',16,13)

		RETURN
	END

	SELECT PartyID,
		CriteriaID,
		IndicatorID,
		Score
	INTO #Evaluation
	FROM vnd.TenderEvaluation a
	JOIN vnd.TenderEvaluationItem b
		ON a.TenderEvaluationID = b.TenderEvaluationID
	WHERE a.TenderID = @TenderID

	SELECT IndicatorID,
		Weight
	INTO #Indicator
	FROM vnd.TenderIndicator a
	JOIN vnd.TenderIndicatorItem b
		ON a.TenderIndicatorID = b.TenderIndicatorID
	WHERE a.TenderID = @TenderID

	SELECT CriteriaID,
		Weight
	INTO #Criteria
	FROM vnd.TenderCriteria a
	JOIN vnd.TenderCriteriaItem b
		ON a.TenderCriteriaID = b.TenderCriteriaID
	WHERE a.TenderID = @TenderID

	SELECT a.PartyID,
		ROUND(sum(a.Average * b.Weight / 10), 2) Score
	INTO #Result
	FROM (
		SELECT a.PartyID,
			a.CriteriaID,
			sum(a.Score * b.Weight / 100) Average
		FROM #Evaluation a
		JOIN #Indicator b
			ON a.IndicatorID = b.IndicatorID
		GROUP BY a.PartyID,
			a.CriteriaID
		) a
	JOIN #Criteria b
		ON a.CriteriaID = b.CriteriaID
	GROUP BY a.PartyID

	SELECT a.PartyID,
		dl.Code PartyCode,
		dl.Title PartyName,
		ROUND(a.Score / 100, 2) Score
	FROM #Result a
	JOIN cfg.Party p
		ON p.PartyID = a.PartyID
	JOIN acc.dl
		ON dl.DLID = p.DlID
END

IF ( @PurchasePlanningID IS NOT NULL AND @TenderID IS NULL )
BEGIN
	SELECT ipi.PartyID
	INTO #Party
	FROM [VND].[InqueryPermission] ip
	JOIN [VND].[InqueryPermissionItem] ipi
		ON ip.InqueryPermissionID = ipi.InqueryPermissionID
	WHERE ip.PurchasePlanningID = @PurchasePlanningID

	SELECT a.PartyID,
		dl.Code PartyCode,
		dl.Title PartyName
	FROM #Party a
	JOIN cfg.Party p
		ON p.PartyID = a.PartyID
	JOIN acc.dl
		ON dl.DLID = p.DlID
END
END;
