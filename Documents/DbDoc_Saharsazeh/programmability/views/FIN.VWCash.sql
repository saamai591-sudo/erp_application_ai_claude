

CREATE  VIEW [FIN].VWCash
--with encryption
AS

	SELECT CashID,
		   cb.FirstAmount Amount,
		   NULL Date,
		   CurrencyID,
		   -1 BranchID,
		   NULL AS FinancialPeriodID
	FROM CFG.CashBalance cb
	
	UNION ALL

	SELECT r.CashID,
		   Amount,
		   rr.Date,
		   r.CurrencyID,
		   rr.BranchID,
		   rr.FinancialPeriodID
	FROM FIN.ReceivedCash r
	JOIN FIN.ReceiveReceipt rr
		ON r.ReceiveReceiptID = rr.ReceiveReceiptID
	JOIN CFG.CashBalance cb 
		ON cb.CashID = r.CashID and cb.CurrencyID = r.CurrencyID

	UNION ALL

	SELECT f.CashID,
		   Amount,
		   f.Date,
		   c.CurrencyID,
		   BranchID,
		   f.FinancialPeriodID
	FROM FIN.ReceiptCheqeFlowItem i
		JOIN FIN.ReceiptCheqeFlow f
			ON i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
		JOIN FIN.ReceivedCheqe c
			ON i.ReceivedCheqeID = c.ReceivedCheqeID
		JOIN CFG.CashBalance cb 
			ON cb.CashID = c.CashID and cb.CurrencyID = c.CurrencyID
	WHERE f.[Type] = 3
		  AND i.[State] = 3

	UNION ALL

	SELECT c.CashID,
		   Amount,
		   pr.Date,
		   s.CurrencyID,
		   BranchID,
		   pr.FinancialPeriodID
	FROM FIN.PaymentSubject s
		JOIN FIN.PaymentReceipt pr
			ON s.PaymentReceiptID = pr.PaymentReceiptID
		JOIN FIN.PaymentType t
			ON s.PaymentTypeID = t.PaymentTypeID
		JOIN CFG.Cash c
			ON s.DLID = c.DlID
		JOIN ACC.DL dl
			ON c.DlID = dl.DLID
		JOIN CFG.CashBalance cb 
			ON cb.CashID = c.CashID and cb.CurrencyID = s.CurrencyID
	WHERE t.[Type] = 5 and pr.Status <> 2

	UNION ALL

	SELECT p.CashID,
		   -1 * Amount Amount,
		   Date,
		   p.CurrencyID,
		   BranchID,
		   pr.FinancialPeriodID
	FROM FIN.PaymentCash p
		JOIN FIN.PaymentReceipt pr
			ON p.PaymentReceiptID = pr.PaymentReceiptID
		JOIN CFG.CashBalance cb 
			ON cb.CashID = p.CashID and cb.CurrencyID = p.CurrencyID
	where pr.Status <> 2

	UNION ALL

	SELECT i.CashID,
		   Amount,
		   r.Date,
		   i.CurrencyID,
		   case when s.BranchID is not null then s.BranchID else -1 end as BranchID,
		   r.FinancialPeriodID
	FROM POS.PosReceiptItem i
		JOIN POS.PosReceipt r
			ON i.PosReceiptID = r.PosReceiptID
		left JOIN POS.StationShift ss
			ON ss.StationShiftID = r.StationShiftID
		left JOIN POS.Station s
			ON s.StationID = ss.StationID
		JOIN CFG.CashBalance cb 
			ON cb.CashID = i.CashID and cb.CurrencyID = i.CurrencyID
	WHERE r.IsPayed = 0 AND i.ItemType = 2

	UNION ALL 

	SELECT i.CashID,
		   -1 * Amount Amount,
		   r.Date,
		   i.CurrencyID,
		   case when s.BranchID is not null then s.BranchID else -1 end as BranchID,
		   r.FinancialPeriodID
	FROM POS.PosReceiptItem i
		JOIN POS.PosReceipt r
			ON i.PosReceiptID = r.PosReceiptID
		left JOIN POS.StationShift ss
			ON ss.StationShiftID = r.StationShiftID
		left JOIN POS.Station s
			ON s.StationID = ss.StationID
		JOIN CFG.CashBalance cb 
			ON cb.CashID = i.CashID and cb.CurrencyID = i.CurrencyID
	WHERE r.IsPayed = 1 AND i.ItemType = 2;
