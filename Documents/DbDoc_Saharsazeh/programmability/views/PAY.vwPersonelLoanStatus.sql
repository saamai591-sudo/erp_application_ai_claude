
----------------------------------------------------Pay.vwPersonelLoanStatus----------------------------------
CREATE   VIEW Pay.vwPersonelLoanStatus
as

SELECT l.LoanID,
       l.PersonelID,
       ISNULL(loan.TotalAmount, l.TotalAmount) TotalAmount,
       ISNULL(ins.InstallmentAmount, l.InstallmentAmount) PlannedInstallmentAmount,
       di.DeductedAmount,
       ISNULL(loan.TotalAmount, l.TotalAmount) - ISNULL(di.DeductedAmount,0)  RemainAmount,
       CASE
            WHEN ISNULL(loan.TotalAmount, l.TotalAmount) > ISNULL(di.DeductedAmount, 0) AND
                 
                 (
                     ISNULL(loan.TotalAmount, l.TotalAmount) - ISNULL(di.DeductedAmount, 0)
                 ) > ISNULL(ins.InstallmentAmount, l.InstallmentAmount) THEN ISNULL(ins.InstallmentAmount, l.InstallmentAmount)
            WHEN ISNULL(loan.TotalAmount, l.TotalAmount) > ISNULL(di.DeductedAmount, 0) AND
                 
                 (
                     ISNULL(loan.TotalAmount, l.TotalAmount) - ISNULL(di.DeductedAmount, 0)
                 ) <= ISNULL(ins.InstallmentAmount, l.InstallmentAmount) THEN ISNULL(loan.TotalAmount, l.TotalAmount) - ISNULL(di.DeductedAmount, 0)
                 ELSE 0 END InstallmentAmount
FROM   pay.Loan AS l
       LEFT JOIN (
                SELECT ROW_NUMBER() OVER(PARTITION BY l2.ParentID ORDER BY l2.[Date] DESC) rno,
                       *
                FROM   pay.Loan AS l2
                WHERE  l2.ParentID IS NOT NULL
                       AND l2.[Type] = 3
            ) loan
            ON  l.LoanID = loan.parentid
            AND loan.rno = 1
       LEFT JOIN (
                SELECT ROW_NUMBER() OVER(PARTITION BY l2.ParentID ORDER BY l2.[Date] DESC) rno,
                       *
                FROM   pay.Loan AS l2
                WHERE  l2.ParentID IS NOT NULL
                       AND l2.[Type] = 2
            ) ins
            ON  l.LoanID = ins.parentid
            AND ins.rno = 1
       LEFT JOIN (
                SELECT SUM(cr.[Value]) DeductedAmount,
                       cr.LoanID
                FROM   pay.CalculationResult AS cr
                WHERE  cr.LoanID IS NOT NULL
                       AND cr.ParameterValueTypeID = 7
                GROUP BY
                       cr.LoanID
            ) di
            ON  l.LoanID = di.LoanID
WHERE  l.[Type] = 1;
