CREATE PROC PAY.GetCalculationTypeStatus
(
    @personelId INT,
    @calendarMonthID INT
)
AS
BEGIN

    SELECT a.CalculationTypeID,
           a.Title CalculationTypeTitle,
           ISNULL(c.Value, 0) Value,
           ISNULL(paid.paid, 0) Paid,
           CAST(CASE
                    WHEN c.CalculationResultID IS NOT NULL THEN
                        1
                    ELSE
                        0
                END AS BIT) IsCalc,
           ISNULL(c.Value, 0) - ISNULL(paid.paid, 0) Remain,
           ISNULL(sc.SettlementCalculationID, 0) SettlementCalculationID,
           b.CalculationPersonelID AS BaseCalculationPersonelID
    FROM pay.CalculationType a
        LEFT JOIN
        (
            SELECT h.CalculationTypeID,
                   SettlementCalculationID
            FROM pay.SettlementCalculation i
                JOIN pay.CalculationPersonel h
                    ON h.CalculationPersonelID = i.CalculationPersonelID
            WHERE h.PersonelID = @personelId
                  AND h.CalendarMonthID = @calendarMonthID
        ) sc
            ON sc.CalculationTypeID = a.CalculationTypeID
        LEFT JOIN pay.CalculationPersonel AS b
            ON a.CalculationTypeID = b.CalculationTypeID
               AND b.CalendarMonthID = @calendarMonthID
               AND b.PersonelID = @personelId
        LEFT JOIN
        (
            SELECT cp.CalculationPersonelID,
                   PersonelID,
                   Value,
                   CalculationResultID,
                   cr.ParameterID
            FROM pay.CalculationResult cr
                JOIN pay.CalculationPersonel AS cp
                    ON cp.CalculationPersonelID = cr.CalculationPersonelID
                JOIN pay.Parameter p
                    ON p.ParameterID = cr.ParameterID
            WHERE SystemName = 'Khales'
                  AND cp.PersonelID = @personelId
        ) c
            ON c.CalculationPersonelID = b.CalculationPersonelID
        LEFT JOIN pay.CalculationResult_NonPayment paid
            ON paid.CalculationResultID = c.CalculationResultID
			left join (
			select cp.CalculationTypeID from pay.SettlementCalculation sc
			JOIN pay.CalculationPersonel AS cp ON sc.BaseCalculationPersonelID = cp.CalculationPersonelID
where cp.PersonelID = @personelId and cp.CalendarMonthID = @calendarMonthID
			)added  on added.CalculationTypeID = a.CalculationTypeID
    WHERE IsPayable = 1
          AND a.engname <> 'Settlement'
		  and added.CalculationTypeID is null 

END;
