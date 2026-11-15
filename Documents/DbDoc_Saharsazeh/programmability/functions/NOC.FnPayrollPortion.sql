CREATE FUNCTION [NOC].FnPayrollPortion
()
RETURNS @T TABLE
(
    CalculationPersonelID INT,
    PersonelID INT,
    VoucherID INT,
    SlID INT,
    Share DECIMAL(36, 10)
)
AS
BEGIN

    INSERT INTO @T
    SELECT CalculationPersonelID,
           PersonelID,
           VoucherID,
           SlID,
           Value / SUM(Value) OVER (PARTITION BY a.CalculationPersonelID) Share
    FROM
    (
        SELECT a.CalculationPersonelID,
               c.PersonelID,
               VoucherID,
               d.SlID,
               SUM(Value) Value
        FROM pay.CalculationResult a
            JOIN pay.Parameter b
                ON a.ParameterID = b.ParameterID
            JOIN pay.CalculationPersonel c
                ON c.CalculationPersonelID = a.CalculationPersonelID
            JOIN hrm.CalendarMonth cm
                ON cm.CalendarMonthID = c.CalendarMonthID
            JOIN pay.CalculationType ct
                ON ct.CalculationTypeID = c.CalculationTypeID
			join  Pay.vwPersonelVoucherSetting pvs
				ON pvs.PersonelID = c.PersonelID and pvs.CalendarMonthID = c.CalendarMonthID
			left join noc.calculationtypesetting cts
					on cts.BenefitParameterID = b.ParameterID
            OUTER APPLY
        (
            SELECT TOP 1
                   OA_a.SlID
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
        ) d
        WHERE b.CategoryID = 2
              AND Value <> 0
              AND ct.EngName <> 'Settlement'
              AND ct.CalculationTypeID NOT IN
                  (
                      SELECT CalculationTypeID FROM noc.calculationtypesetting
                  )
        GROUP BY a.CalculationPersonelID,
                 c.PersonelID,
                 VoucherID,
                 d.SlID
        UNION ALL
        SELECT vw.CalculationPersonelID,
               c.PersonelID,
               vw.VoucherID,
               vw.SlID,
               vw.Value
        FROM pay.CalculationPersonel c
            JOIN pay.CalculationType ct
                ON c.CalculationTypeID = ct.CalculationTypeID
                   AND EngName <> 'Settlement'
            JOIN pay.CalculationResult a
                ON c.CalculationPersonelID = a.CalculationPersonelID
            JOIN pay.Parameter p
                ON a.ParameterID = p.ParameterID
            JOIN noc.VWCalculationTypeHasReserve vw
                ON vw.CalculationPersonelID = c.CalculationPersonelID
                   AND
                   (
                       vw.netparam = p.ParameterID
                       OR p.ParameterID IN
                          (
                              SELECT ParameterID FROM noc.FractionPayrollParameterSetting WHERE type = 1
                          )
                   )
        WHERE a.Value <> 0
    ) a;



    INSERT INTO @T
    SELECT a.CalculationPersonelID,
           PersonelID,
           VoucherID,
           SlID,
           a.Share * sc.Share
    FROM
    (
        SELECT CalculationPersonelID,
               PersonelID,
               VoucherID,
               SlID,
               CalculationTypeID,
               Value / SUM(Value) OVER (PARTITION BY OriginalCalculationPersonelID) Share
        FROM
        (
            SELECT c.CalculationPersonelID,
                   c.PersonelID,
                   c2.voucherid,
                   c2.CalculationPersonelID OriginalCalculationPersonelID,
                   d.SlID,
                   cr.Value,
                   p.CalculationTypeID
            FROM pay.CalculationPersonel c
                JOIN pay.CalculationType ct
                    ON c.CalculationTypeID = ct.CalculationTypeID
                       AND EngName = 'Settlement'
                JOIN pay.SettlementCalculation sc
                    ON c.CalculationPersonelID = sc.CalculationPersonelID
                JOIN pay.CalculationPersonel c2
                ON sc.BaseCalculationPersonelID = c2.CalculationPersonelID
                JOIN pay.CalculationResult cr
                    ON cr.CalculationPersonelID = c2.CalculationPersonelID
                JOIN pay.Parameter p
                    ON p.ParameterID = cr.ParameterID
                JOIN hrm.CalendarMonth cm
                    ON cm.CalendarMonthID = c.CalendarMonthID
				join  Pay.vwPersonelVoucherSetting pvs
					ON pvs.PersonelID = c.PersonelID and pvs.CalendarMonthID = c.CalendarMonthID
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
                                         ELSE p.ParameterID
                                     END
                      AND OA_a.PayrollAccGroupID = pvs.PayrollAccGroupID
                      AND OA_cm.EndDate <= cm.EndDate
                ORDER BY OA_cm.EndDate DESC
            ) d
            WHERE p.CategoryID = 2
                  AND cr.Value <> 0
                  AND sc.Value - sc.Paid <> 0
                  AND c2.CalculationTypeID NOT IN
                      (
                          SELECT CalculationTypeID FROM noc.calculationtypesetting
                      )
            UNION ALL
            SELECT c.CalculationPersonelID,
                   c.PersonelID,
                   vw.voucherid,
                   c2.CalculationPersonelID OriginalCalculationPersonelID,
                   vw.SlID,
                   vw.Value,
                   c2.CalculationTypeID
            FROM pay.CalculationPersonel c
                JOIN pay.CalculationType ct
                    ON c.CalculationTypeID = ct.CalculationTypeID
                       AND EngName = 'Settlement'
                JOIN pay.SettlementCalculation sc
                    ON c.CalculationPersonelID = sc.CalculationPersonelID
                JOIN pay.CalculationPersonel c2
                    ON sc.BaseCalculationPersonelID = c2.CalculationPersonelID
                JOIN noc.VWCalculationTypeHasReserve vw
                    ON vw.CalculationPersonelID = c2.CalculationPersonelID
            WHERE sc.Value - sc.Paid <> 0 
        ) a
    ) a
        JOIN
        (
            SELECT sc.CalculationPersonelID,
                   cp.CalculationTypeID,
                   sc.Value - sc.paid Remain,
                   CONVERT(FLOAT, sc.Value - sc.paid)
                   / CONVERT(FLOAT, SUM(sc.Value - sc.paid) OVER (PARTITION BY sc.CalculationPersonelID)) Share
            FROM pay.SettlementCalculation sc
            JOIN pay.CalculationPersonel AS cp ON sc.CalculationPersonelID = cp.CalculationPersonelID 
            WHERE (sc.Value - sc.Paid) <> 0
        ) sc
            ON a.CalculationPersonelID = sc.CalculationPersonelID
               AND a.CalculationTypeID = sc.CalculationTypeID;

    RETURN;
END;
