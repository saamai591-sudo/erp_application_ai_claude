
CREATE   PROC [NOC].SpPayrollCostPortion
AS

	create table #Result
	(
	PayPreparingID int,
	PersonelID int,
	VoucherID int,
	SlID int,
	CalculationTypeID int,
	Amount decimal(36,10),
	ShareOfRoundingIsAllowed bit
	)

		insert into #Result
        SELECT i.PayPreparingID,
               d.PersonelID,
               d.VoucherID,
               OA.SlID,
               ct.CalculationTypeID,
			   round(i.Value * (CONVERT(FLOAT, a.Value) / CONVERT(FLOAT, SUM(a.Value) OVER (PARTITION BY i.PayPreparingItemID,a.CalculationPersonelID))) ,cfg.GetBaseCurrencyPrecision()) AS Amount,
			   1 ShareOfRoundingIsAllowed
        FROM pay.PayPreparingItem i
            JOIN pay.PayPreparing h
                ON i.PayPreparingID = h.PayPreparingID
            JOIN pay.Parameter p
                ON p.ParameterID = i.ParameterID
            JOIN pay.CalculationType ct
                ON p.CalculationTypeID = ct.CalculationTypeID
                   AND ct.EngName <> 'Settlement'
            JOIN pay.CalculationPersonel d
                ON d.CalendarMonthID = h.CalendarMonthID
                   AND d.PersonelID = i.PersonnelID
                   AND ct.CalculationTypeID = d.CalculationTypeID
            JOIN hrm.CalendarMonth cm
                ON cm.CalendarMonthID = d.CalendarMonthID
            JOIN pay.CalculationResult a
                ON d.CalculationPersonelID = a.CalculationPersonelID
            JOIN pay.Parameter b
                ON a.ParameterID = b.ParameterID
			join  Pay.vwPersonelVoucherSetting pvs
				ON pvs.PersonelID = d.PersonelID and pvs.CalendarMonthID = d.CalendarMonthID
			left join noc.calculationtypesetting cts
					on cts.BenefitParameterID = p.ParameterID
            OUTER APPLY
        (
            SELECT TOP 1
                   SlID
            FROM pay.PayrollAccConfiguration OA_a
                JOIN hrm.CalendarMonth OA_cm
                    ON OA_a.CalendarMonthID = OA_cm.CalendarMonthID
            WHERE OA_a.ParameterID = CASE
                                         WHEN cts.BenefitParameterID is not null THEN cts.DifferenceParameterid
                                         ELSE b.ParameterID
                                     END
                  AND OA_a.PayrollAccGroupID = pvs.PayrollAccGroupID
                  AND OA_cm.EndDate <= cm.EndDate
            ORDER BY OA_cm.EndDate DESC
        ) OA
        WHERE b.CategoryID = 2
              AND a.Value <> 0
              AND p.CategoryID <> 4
              AND ct.CalculationTypeID NOT IN
                  (
                      SELECT CalculationTypeID FROM noc.calculationtypesetting
                  )

		
		insert into #Result
        SELECT i.PayPreparingID,
               vw.PersonelID,
               vw.VoucherID,
               vw.SlID,
               vw.CalculationTypeID,
			   round(i.Value * (CONVERT(FLOAT, vw.Value) / CONVERT(FLOAT, SUM(vw.Value) OVER (PARTITION BY i.PayPreparingItemID,vw.CalculationPersonelID))),cfg.GetBaseCurrencyPrecision()) AS Amount,
			   1 ShareOfRoundingIsAllowed
        FROM pay.PayPreparingItem i
            JOIN pay.PayPreparing h
                ON i.PayPreparingID = h.PayPreparingID
            JOIN pay.Parameter p
                ON p.ParameterID = i.ParameterID
            JOIN ##CalculationTypeHasReserveForNIOCReports vw
                ON vw.CalendarMonthID = h.CalendarMonthID
                   AND vw.CalculationTypeID = p.CalculationTypeID
                   AND vw.PersonelID = i.PersonnelID
                   AND
                   (
                       vw.netparam = p.ParameterID
                       OR p.ParameterID IN
                          (
                              SELECT ParameterID FROM noc.FractionPayrollParameterSetting WHERE type = 2
                          )
                   )


		insert into #Result
        SELECT h.PayPreparingID,
               ca.PersonelID,
               ca.VoucherID,
               OA.SlID,
               ca.CalculationTypeID,
			   i.Value AS Amount,
			   0 ShareOfRoundingIsAllowed
        FROM pay.PayPreparingItem i
            JOIN pay.PayPreparing h
                ON h.PayPreparingID = i.PayPreparingID
            JOIN pay.Parameter b
                ON i.ParameterID = b.ParameterID
            JOIN pay.CalculationPersonel ca
                ON ca.CalendarMonthID = h.CalendarMonthID
                   AND ca.PersonelID = i.PersonnelID
                   AND ca.CalculationTypeID = b.CalculationTypeID
            JOIN hrm.CalendarMonth cm
                ON cm.CalendarMonthID = ca.CalendarMonthID
            JOIN pay.CalculationResult cr
                ON cr.ParameterID = i.ParameterID
                   AND cr.CalculationPersonelID = ca.CalculationPersonelID
			join  Pay.vwPersonelVoucherSetting pvs
				ON pvs.PersonelID = ca.PersonelID and pvs.CalendarMonthID = ca.CalendarMonthID
			left join noc.calculationtypesetting cts
					on cts.BenefitParameterID = b.ParameterID
            OUTER APPLY
        (
            SELECT TOP 1
                   SlID
            FROM pay.PayrollAccConfiguration OA_a
                JOIN hrm.CalendarMonth OA_cm
                    ON OA_a.CalendarMonthID = OA_cm.CalendarMonthID
            WHERE OA_a.ParameterID = CASE
                                         WHEN cts.BenefitParameterID is not null THEN cts.DifferenceParameterid
                                         ELSE b.ParameterID
                                     END
                  AND OA_a.PayrollAccGroupID = pvs.PayrollAccGroupID
                  AND OA_a.BalanceType = 0
                  AND OA_cm.EndDate <= cm.EndDate
            ORDER BY OA_cm.EndDate DESC
        ) OA
        WHERE b.CategoryID = 4

		insert into #Result
		SELECT PayPreparingID,
			   PersonnelID,
			   VoucherID,
			   SlID,
			   a.CalculationTypeID,
			   round(a.Amount * (a.Share * sc.Share),cfg.GetBaseCurrencyPrecision()) Amount,
			   1 ShareOfRoundingIsAllowed
		FROM
		(
			SELECT c.PayPreparingID,
				   PersonnelID,
				   VoucherID,
				   c.SlID,
				   CalculationPersonelID,
				   CalculationTypeID,
				   CONVERT(FLOAT, c.Value)/ CONVERT(FLOAT, SUM(c.Value) OVER (PARTITION BY c.PayPreparingItemID, c.CalculationPersonelID)) AS Share,
				   c.Amount
			FROM
			(
				SELECT h.PayPreparingID,
					   c.CalculationPersonelID,
					   i.PersonnelID,
					   c.VoucherID,
					   OA.SlID,
					   cr.Value,
					   c2.CalculationTypeID,
					   i.PayPreparingItemID,
					   i.Value Amount
				FROM pay.PayPreparingItem i
					JOIN pay.PayPreparing h
						ON h.PayPreparingID = i.PayPreparingID
					JOIN pay.Parameter b
						ON i.ParameterID = b.ParameterID
					JOIN pay.CalculationType ct
						ON b.CalculationTypeID = ct.CalculationTypeID
						   AND ct.EngName = 'Settlement'
					JOIN pay.CalculationPersonel c
						ON b.CalculationTypeID = c.CalculationTypeID
						   AND h.CalendarMonthID = c.CalendarMonthID
						   AND c.PersonelID = i.PersonnelID
					JOIN pay.SettlementCalculation sc
						ON c.CalculationPersonelID = sc.CalculationPersonelID
					JOIN pay.CalculationPersonel c2 
						ON c2.CalculationPersonelID = sc.BaseCalculationPersonelID
					JOIN pay.CalculationResult cr
						ON cr.CalculationPersonelID = c.CalculationPersonelID
					JOIN pay.Parameter p
						ON p.ParameterID = cr.ParameterID
					JOIN hrm.CalendarMonth cm
						ON cm.CalendarMonthID = c.CalendarMonthID
					join  Pay.vwPersonelVoucherSetting pvs
						ON pvs.PersonelID = c.PersonelID and pvs.CalendarMonthID = c.CalendarMonthID
					left join noc.calculationtypesetting cts
							on cts.BenefitParameterID = b.ParameterID
					OUTER APPLY
				(
					SELECT TOP 1
						   SlID
					FROM pay.PayrollAccConfiguration OA_a
						JOIN hrm.CalendarMonth OA_cm
							ON OA_a.CalendarMonthID = OA_cm.CalendarMonthID
					WHERE OA_a.ParameterID = CASE
											 WHEN cts.BenefitParameterID is not null THEN cts.DifferenceParameterid
											 ELSE p.ParameterID
										 END
						  AND OA_a.PayrollAccGroupID = pvs.PayrollAccGroupID
						  AND OA_a.BalanceType = 0
						  AND OA_cm.EndDate <= cm.EndDate
					ORDER BY OA_cm.EndDate DESC
				) OA
				WHERE p.CategoryID = 2
					  AND cr.Value <> 0
					  AND sc.Value - sc.Paid <> 0
					  AND c.CalculationTypeID NOT IN
						  (
							  SELECT CalculationTypeID FROM noc.calculationtypesetting
						  )
            UNION ALL
            SELECT h.PayPreparingID,
                   vw.CalculationPersonelID,
                   i.PersonnelID,
                   vw.VoucherID,
                   vw.SlID,
                   vw.Value,
                   c2.CalculationTypeID,
				   i.PayPreparingItemID,
				   i.Value Amount
            FROM pay.PayPreparingItem i
                JOIN pay.PayPreparing h
                    ON h.PayPreparingID = i.PayPreparingID
                JOIN pay.Parameter b
                    ON i.ParameterID = b.ParameterID
                JOIN pay.CalculationType ct
                    ON b.CalculationTypeID = ct.CalculationTypeID
                       AND ct.EngName = 'Settlement'
                JOIN pay.CalculationPersonel c
                    ON b.CalculationTypeID = c.CalculationTypeID
                       AND h.CalendarMonthID = c.CalendarMonthID
                       AND c.PersonelID = i.PersonnelID
                JOIN pay.SettlementCalculation sc
                    ON c.CalculationPersonelID = sc.CalculationPersonelID
                JOIN pay.CalculationPersonel c2 
                    ON c2.CalculationPersonelID = sc.BaseCalculationPersonelID
                JOIN ##CalculationTypeHasReserveForNIOCReports vw
                    ON vw.CalculationPersonelID = c.CalculationPersonelID
            WHERE sc.Value - sc.Paid <> 0
        ) c
        WHERE SlID IS NOT NULL
    ) a
        JOIN
        (
            SELECT sc.CalculationPersonelID,
                   cp.CalculationTypeID,
                   sc.Value - sc.paid Remain,
                   CONVERT(FLOAT, Value - paid)
                   / CONVERT(FLOAT, SUM(Value - paid) OVER (PARTITION BY sc.CalculationPersonelID)) Share
            FROM pay.SettlementCalculation sc
			JOIN PAY.CalculationPersonel cp on sc.BaseCalculationPersonelID = cp.CalculationPersonelID
            WHERE Value - Paid <> 0
        ) sc
            ON a.CalculationPersonelID = sc.CalculationPersonelID
               AND a.CalculationTypeID = sc.CalculationTypeID

select * from #Result
