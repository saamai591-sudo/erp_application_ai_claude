
CREATE    PROC [FIN].RPT_LiquidityPerspective_Branch
(@ToDate DATE)
--WITH ENCRYPTION
AS
DECLARE @Culture VARCHAR(25),
        @CultureNo TINYINT,
        @userId INT;

SET @userId = CFG.GetuserID();

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

select * into #vwBranchAccess
from cfg.vwBranchAccess

select * into #a from (
		select BranchID,CurrencyID,Amount from FIN.vwbankaccount   WHERE (Date is null or Date <= GETDATE())
		union all
		select BranchID,CurrencyID,Amount from FIN.VWCash   WHERE (Date is null or Date <= GETDATE())
		) a


	SELECT B.Code BranchCode,
		   B.Title BranchTitle,
		   B.BranchID,
		   ISNULL(A.Amount, 0) CashBalance,
		   ISNULL([ReceivedCheqe], 0) [ReceivedCheqe],
		   ISNULL([ReceivedInstallment], 0) [ReceivedInstallment],
		   ISNULL([PaymentCheqe], 0) [PaymentCheqe],
		   ISNULL([PaymentInstallment], 0) [PaymentInstallment],
		   ISNULL(A.Amount, 0) + ISNULL([ReceivedCheqe], 0) + ISNULL([ReceivedInstallment], 0)+ ISNULL([PaymentCheqe], 0) + ISNULL([PaymentInstallment], 0) Remain
	FROM
    (
        SELECT vw.BranchID,
			   SUM(
				   CASE
					   WHEN vw.CurrencyID = -1 THEN
						   vw.Amount
					   ELSE
						   ROUND(vw.Amount * CR.Rate / C.ExchangeUnit, CFG.GetBaseCurrencyPrecision())
				   END 
			     ) Amount
        FROM #a vw
        JOIN CFG.Currency C
            ON C.CurrencyID = vw.CurrencyID
        LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY CurrencyID ORDER BY Date DESC) Rno,
                       CurrencyID,
                       Rate
                FROM CFG.CurrencyRate
            ) CR
                ON vw.CurrencyID = CR.CurrencyID
                   AND CR.Rno = 1
        WHERE (
                  vw.CurrencyID = -1
                  OR CR.CurrencyID IS NOT NULL
              )
       group by vw.BranchID
    ) A
	join cfg.Branch B on B.BranchID = a.BranchID
	join #vwBranchAccess vba on b.BranchID = vba.BranchID
	left join
	(
		SELECT BranchID,
			   BranchCode,
			   [Type],
			   CASE
				   WHEN @CultureNo = 1 THEN
					   BranchTitle
				   WHEN @CultureNo = 2 THEN
					   BranchTitle2
			   END AS BranchTitle,
			   SUM(Amount) Amount
		FROM FIN.VWLiquidityPerspective
		WHERE Date <= @ToDate
		GROUP BY BranchID,
				 BranchCode,
				 [Type],
				 BranchTitle,
				 BranchTitle2
	) X
	PIVOT
	(
		SUM(Amount)
		FOR [Type] IN ([ReceivedCheqe], [ReceivedInstallment], [PaymentCheqe], [PaymentInstallment])
	) P
   on p.BranchID = A.BranchID
