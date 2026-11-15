

CREATE   VIEW [NOC].[vwCalculationTypeHasReserve]
AS 


SELECT cp.CalculationPersonelID,
       cp.CalculationTypeID,
       cm.CalendarMonthID,
       cp.PersonelID,
       cm.EndDate,
       a.PreviousCalcDate,
       b.ParameterID,
       b.[Value],
       b.SlID,
       b.VoucherID,
       NetParameter.ParameterID NetParam
FROM   noc.CalculationTypeSetting    AS cts
       JOIN pay.CalculationPersonel  AS cp
            ON  cp.CalculationTypeID = cts.CalculationTypeID
       JOIN hrm.CalendarMonth        AS cm
            ON  cm.CalendarMonthID = cp.CalendarMonthID
       JOIN pay.CalculationResult    AS cr
            ON  cr.CalculationPersonelID = cp.CalculationPersonelID
       JOIN pay.Parameter            AS p
            ON  p.ParameterID = cr.ParameterID
            AND p.CategoryID = 2
       OUTER APPLY (
				SELECT TOP 1 
					   c2.CalculationTypeID,
					   c2.PersonelID,
					   cm2.CalendarMonthID,
					   cm2.EndDate                      PreviousCalcDate
				FROM   pay.CalculationPersonel       AS c2
					   JOIN hrm.CalendarMonth        AS cm2
							ON  cm2.CalendarMonthID = c2.CalendarMonthID
				WHERE  cm2.EndDate < cm.EndDate
					   AND c2.PersonelID = cp.PersonelID
					   AND c2.CalculationTypeID = cp.CalculationTypeID
				ORDER BY
					   cm2.EndDate DESC
				) a
		JOIN (
				SELECT cr3.ParameterID,
                       cr3.[Value],
                       cp3.PersonelID,
                       cts2.DifferenceParameterid,
                       paccm.SlID,
                       cp3.VoucherID,
                       cm3.EndDate,
                       cm3.CalendarMonthID
                FROM   noc.CalculationTypeSetting AS cts2
                       JOIN pay.CalculationResult AS cr3
                            ON  cr3.ParameterID = cts2.ReserveParameterID
                       JOIN pay.CalculationPersonel AS cp3
                            ON  cr3.CalculationPersonelID = cp3.CalculationPersonelID
                       JOIN hrm.CalendarMonth AS cm3
                            ON  cp3.CalendarMonthID = cm3.CalendarMonthID
                       JOIN pay.vwPersonelVoucherSetting AS vpvs
                            ON  vpvs.CalendarMonthID = cm3.CalendarMonthID
                            AND vpvs.PersonelID = cp3.PersonelID
                       JOIN pay.PayrollAccConfigurationCalendarMonth AS paccm
                            ON  vpvs.PayrollAccGroupID = paccm.PayrollAccGroupID
                            AND paccm.CalendarMonthID = cm3.CalendarMonthID
                            AND cr3.ParameterID = paccm.ParameterID
                            AND paccm.BalanceType = 0
            ) b
            ON b.EndDate <= cm.EndDate
            AND b.PersonelID = cp.PersonelID
            AND b.DifferenceParameterid = cts.DifferenceParameterid
			and ( b.EndDate > a.PreviousCalcDate or a.PreviousCalcDate is null)
		OUTER APPLY (
						SELECT P4.ParameterID
						FROM   pay.Parameter AS p4
						WHERE  p4.SystemName = 'khales'
						AND p4.CalculationTypeID = cts.CalculationTypeID
					)  NetParameter


UNION ALL
SELECT c.CalculationPersonelID,
       c.CalculationTypeID,
       cm.CalendarMonthID,
       c.PersonelID,
       cm.EndDate,
       NULL,
       cr.ParameterID,
       cr.[Value],
       paccm.SlID,
       c.VoucherID,
       NetParameter.ParameterID
FROM   noc.CalculationTypeSetting         AS cts
       JOIN pay.CalculationPersonel c
            ON  cts.CalculationTypeID = c.CalculationTypeID
       JOIN hrm.CalendarMonth             AS cm
            ON  cm.CalendarMonthID = c.CalendarMonthID
       JOIN pay.CalculationResult         AS cr
            ON  cr.CalculationPersonelID = c.CalculationPersonelID
            AND cr.ParameterID = cts.DifferenceParameterid
       JOIN pay.vwPersonelVoucherSetting  AS vpvs
            ON  vpvs.PersonelID = c.PersonelID
            AND vpvs.CalendarMonthID = cm.CalendarMonthID
       JOIN pay.PayrollAccConfigurationCalendarMonth AS paccm
            ON  paccm.CalendarMonthID = cm.CalendarMonthID
            AND vpvs.PayrollAccGroupID = paccm.PayrollAccGroupID
            AND cr.ParameterID = paccm.ParameterID
       OUTER APPLY (
    SELECT P4.ParameterID
    FROM   pay.Parameter AS p4
    WHERE  p4.SystemName = 'khales'
           AND p4.CalculationTypeID = cts.CalculationTypeID
)                                            NetParameter
where cr.Value<>0