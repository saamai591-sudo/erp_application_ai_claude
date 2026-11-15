CREATE VIEW [PAY].CalculationResult_NonPayment
AS 

SELECT cr.CalculationResultID,
       cr.[Value],
       ISNULL(mr.Amount, 0) + ISNULL(ps.Amount, 0) +
       ISNULL(dcni.Amount, 0) + ISNULL(prepare.[Value], 0)+ISNULL(Settled.SettledAmount,0) AS Paid,
       (cr.[Value]) - ISNULL(mr.Amount, 0) - ISNULL(ps.Amount, 0) -
       ISNULL(dcni.Amount, 0) -ISNULL(prepare.[Value], 0)-ISNULL(Settled.SettledAmount,0) AS Remain
FROM   pay.CalculationResult       AS cr
       INNER JOIN pay.Parameter    AS p
            ON  p.ParameterID = cr.ParameterID
       INNER JOIN pay.CalculationPersonel AS   c
            ON  c.CalculationPersonelID = cr.CalculationPersonelID
       LEFT JOIN (
                SELECT CalculationResultID,
                       SUM(Amount) AS Amount
                FROM   cfg.ManualReceipt
                WHERE  CalculationResultID IS NOT NULL
                GROUP BY
                       cfg.ManualReceipt.CalculationResultID
            ) mr
            ON  mr.CalculationResultID = cr.CalculationResultID
       LEFT JOIN (
                SELECT CalculationResultID,
                       SUM(Amount) AS Amount
                FROM   fin.PaymentSubject a
                       JOIN fin.PaymentReceipt b
                            ON  a.PaymentReceiptID = b.PaymentReceiptID
                WHERE  CalculationResultID IS NOT NULL
                       AND b.Status <> 2
                GROUP BY
                       a.CalculationResultID
            ) ps
            ON  ps.CalculationResultID = cr.CalculationResultID
       LEFT JOIN (
                SELECT CalculationResultID,
                       SUM(Amount - Discount) AS Amount
                FROM   CFG.DebitCreditNoteItem
                WHERE  CalculationResultID IS NOT NULL
                GROUP BY
                       CalculationResultID
            ) dcni
            ON  cr.CalculationResultID = dcni.CalculationResultID
       LEFT JOIN (
                SELECT SUM(ppi.[Value]) [VALUE],
                       ccr.CalculationResultID
                FROM   pay.PayPreparingItem AS ppi
                       JOIN pay.PayPreparing AS pp
                            ON  pp.PayPreparingID = ppi.PayPreparingID
                       JOIN (
                                SELECT c.CalculationPersonelID,
                                       c.CalendarMonthID,
                                       cr2.ParameterID,
                                       c.PersonelID,
                                       cr2.[Value],
                                       cr2.CalculationResultID
                                FROM   pay.CalculationPersonel AS c
                                       JOIN pay.CalculationResult AS cr2
                                            ON  cr2.CalculationPersonelID = c.CalculationPersonelID
                            ) ccr
                            ON  ccr.CalendarMonthID = pp.CalendarMonthID
                            AND ppi.ParameterID = ccr.ParameterID
                            AND ppi.PersonnelID = ccr.PersonelID
                GROUP BY
                       ccr.CalculationResultID
            ) prepare
            ON  cr.CalculationResultID = prepare.CalculationResultID
       LEFT JOIN (
                SELECT cr2.CalculationResultID,
                       sc.[Value] -sc.Paid AS SettledAmount
                FROM   pay.CalculationPersonel AS s
                       JOIN pay.SettlementCalculation AS sc
                            ON  sc.CalculationPersonelID = s.CalculationPersonelID
                       JOIN pay.CalculationResult AS cr3
                            ON  cr3.CalculationPersonelID = sc.BaseCalculationPersonelID
                       JOIN pay.CalculationResult AS cr2
                            ON  cr2.CalculationPersonelID = s.CalculationPersonelID
                       JOIN pay.Parameter AS p
                            ON  cr2.ParameterID = p.ParameterID
                WHERE  p.SystemName = 'khales'
            ) Settled
            ON  cr.CalculationResultID = Settled.CalculationResultID
WHERE  p.SystemName IN( 'Khales' ,'SettlementParam')
